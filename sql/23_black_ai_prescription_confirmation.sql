-- ============================================================
-- BLACK OS — BLACK AI
-- RECETA: ESTADO DE CONFIRMACION + VALIDACION DE CAMPOS v1
-- ============================================================
-- Objetivos:
-- 1) Separar "receta detectada" de "receta confirmada".
-- 2) Guardar trazabilidad de la lectura visual.
-- 3) Corregir el motor para que JSON null NO cuente como dato presente.
--
-- Esta migracion es aditiva e idempotente.
-- ============================================================

alter table public.black_ai_case_state
  add column if not exists prescription_status text not null default 'none',
  add column if not exists prescription_confirmed_at timestamptz,
  add column if not exists prescription_source_message_id text,
  add column if not exists prescription_analysis jsonb not null default '{}'::jsonb,
  add column if not exists prescription_updated_at timestamptz,
  add column if not exists conversation_started_at timestamptz not null default now(),
  add column if not exists last_patient_message_at timestamptz;

-- Agregamos el CHECK de manera segura para instalaciones donde la columna
-- ya pudiera existir por una prueba anterior.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'black_ai_case_state_prescription_status_check'
      and conrelid = 'public.black_ai_case_state'::regclass
  ) then
    alter table public.black_ai_case_state
      add constraint black_ai_case_state_prescription_status_check
      check (prescription_status in (
        'none',
        'detected',
        'awaiting_confirmation',
        'confirmed',
        'needs_review'
      ));
  end if;
end $$;

create index if not exists black_ai_case_state_prescription_status_idx
  on public.black_ai_case_state (prescription_status, updated_at desc);

comment on column public.black_ai_case_state.prescription_status is
'Estado de la receta: none, detected, awaiting_confirmation, confirmed o needs_review.';

comment on column public.black_ai_case_state.prescription_confirmed_at is
'Fecha/hora en que el paciente confirmo explicitamente la transcripcion de la receta.';

comment on column public.black_ai_case_state.prescription_source_message_id is
'ID del mensaje de WhatsApp/Evolution que origino la lectura de receta mas reciente.';

comment on column public.black_ai_case_state.prescription_analysis is
'Trazabilidad estructurada de la lectura visual: confianza, campos dudosos y metadatos de procesamiento.';

-- ============================================================
-- CORRECCION CRITICA:
-- JSON {"sphere": null} NO debe considerarse un dato completo.
-- ============================================================
create or replace function public.black_ai_next_question_key(
  p_objective text,
  p_prescription jsonb,
  p_optical_case text,
  p_main_use text,
  p_previous_lens_type text,
  p_technical_family_key text,
  p_technical_result jsonb
)
returns text
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  rx jsonb := coalesce(p_prescription,'{}'::jsonb);
  od jsonb := coalesce(p_prescription->'od','{}'::jsonb);
  oi jsonb := coalesce(p_prescription->'oi','{}'::jsonb);
  od_sphere text := nullif(od->>'sphere','');
  od_cylinder text := nullif(od->>'cylinder','');
  od_axis text := nullif(od->>'axis','');
  oi_sphere text := nullif(oi->>'sphere','');
  oi_cylinder text := nullif(oi->>'cylinder','');
  oi_axis text := nullif(oi->>'axis','');
  add_value text := nullif(p_prescription->>'addition','');
begin
  if p_objective is null then return 'clarify_objective'; end if;

  if p_objective in ('quote','buy','renew','prescription_quote') then
    if rx='{}'::jsonb then return 'request_prescription'; end if;

    -- Una clave presente con valor JSON null sigue siendo un dato faltante.
    if od_sphere is null
       or od_cylinder is null
       or oi_sphere is null
       or oi_cylinder is null then
      return 'complete_prescription';
    end if;

    if coalesce(od_cylinder::numeric,0) <> 0 and od_axis is null then
      return 'request_axis_od';
    end if;

    if coalesce(oi_cylinder::numeric,0) <> 0 and oi_axis is null then
      return 'request_axis_oi';
    end if;

    if p_optical_case in ('bifocal','occupational','multifocal') and add_value is null then
      return 'request_addition';
    end if;

    if p_optical_case is null then return 'clarify_optical_case'; end if;
    if p_main_use is null then return 'ask_main_use'; end if;

    if p_previous_lens_type is null and p_optical_case in ('occupational','multifocal') then
      return 'ask_previous_lens_experience';
    end if;

    if p_technical_family_key is null then return 'choose_technical_family'; end if;
    if p_technical_result is null or p_technical_result='{}'::jsonb then return 'run_technical_evaluation'; end if;
  end if;

  return 'ready_for_proposal';
end;
$$;

grant execute on function public.black_ai_next_question_key(text,jsonb,text,text,text,text,jsonb) to authenticated;
grant execute on function public.black_ai_next_question_key(text,jsonb,text,text,text,text,jsonb) to service_role;
revoke all on function public.black_ai_next_question_key(text,jsonb,text,text,text,text,jsonb) from anon;

-- ============================================================
-- COMPROBACION RAPIDA OPCIONAL
-- Debe devolver "complete_prescription", no avanzar como si estuviera completa.
-- ============================================================
-- select public.black_ai_next_question_key(
--   'quote',
--   '{"od":{"sphere":null,"cylinder":null,"axis":null},"oi":{"sphere":null,"cylinder":null,"axis":null}}'::jsonb,
--   'monofocal',
--   null,
--   null,
--   null,
--   '{}'::jsonb
-- );
