-- ============================================================
-- BLACK OS — BLACK AI
-- ESTADO DE CASO + EVALUACION DE RECETA v1
-- ============================================================
-- Objetivo:
-- 1) Guardar qué información ya obtuvo Black AI de una conversación.
-- 2) Determinar qué dato falta antes de recomendar/cotizar.
-- 3) Evaluar receta + familia técnica usando la matriz real Stock/R.E./Lab.
-- 4) Mantener separada la lógica determinística de la redacción conversacional.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. ESTADO CONVERSACIONAL PERSISTENTE
-- ------------------------------------------------------------
create table if not exists public.black_ai_case_state (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  objective text,
  stage text not null default 'discovery' check (stage in (
    'discovery','prescription','needs','technical','proposal','human_review','closed'
  )),
  prescription jsonb not null default '{}'::jsonb,
  optical_case text,
  technical_family_key text,
  main_use text,
  previous_lens_type text,
  budget_context text,
  urgency text,
  preferences jsonb not null default '{}'::jsonb,
  technical_result jsonb not null default '{}'::jsonb,
  candidate_products jsonb not null default '[]'::jsonb,
  missing_data text[] not null default '{}',
  next_best_question_key text,
  next_best_question_context jsonb not null default '{}'::jsonb,
  confidence numeric(4,3),
  requires_human_review boolean not null default false,
  last_inbox_id uuid references public.black_ai_inbox(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists black_ai_case_state_stage_idx
  on public.black_ai_case_state(stage, updated_at desc);

alter table public.black_ai_case_state enable row level security;
grant select, insert, update, delete on table public.black_ai_case_state to authenticated;
grant select, insert, update on table public.black_ai_case_state to service_role;
revoke all on table public.black_ai_case_state from anon;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='black_ai_case_state'
      and policyname='black_ai_case_state_auth_all'
  ) then
    create policy black_ai_case_state_auth_all
      on public.black_ai_case_state
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

comment on table public.black_ai_case_state is
'Estado persistente de una conversación de Black AI: qué se sabe, qué falta y cuál es el próximo paso. No define por sí solo el texto de respuesta.';

-- ------------------------------------------------------------
-- 2. EVALUACION DETERMINISTICA DE RECETA + FAMILIA TECNICA
-- ------------------------------------------------------------
create or replace function public.black_ai_evaluate_prescription_case(
  p_family_key text,
  p_optical_case text,
  p_sphere_od numeric,
  p_cylinder_od numeric,
  p_axis_od integer,
  p_sphere_oi numeric,
  p_cylinder_oi numeric,
  p_axis_oi integer,
  p_addition numeric default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  pair_result jsonb;
  missing text[] := '{}';
  needs_axis boolean := false;
  prescription_complete boolean := true;
  final_mode text;
begin
  if p_optical_case is null then missing := array_append(missing,'optical_case'); end if;
  if p_sphere_od is null then missing := array_append(missing,'sphere_od'); end if;
  if p_cylinder_od is null then missing := array_append(missing,'cylinder_od'); end if;
  if p_sphere_oi is null then missing := array_append(missing,'sphere_oi'); end if;
  if p_cylinder_oi is null then missing := array_append(missing,'cylinder_oi'); end if;

  needs_axis := coalesce(p_cylinder_od,0) <> 0 or coalesce(p_cylinder_oi,0) <> 0;
  if needs_axis and p_cylinder_od is not null and p_cylinder_od <> 0 and p_axis_od is null then
    missing := array_append(missing,'axis_od');
  end if;
  if needs_axis and p_cylinder_oi is not null and p_cylinder_oi <> 0 and p_axis_oi is null then
    missing := array_append(missing,'axis_oi');
  end if;

  if p_optical_case in ('bifocal','occupational','multifocal') and p_addition is null then
    missing := array_append(missing,'addition');
  end if;

  prescription_complete := cardinality(missing)=0;

  if p_family_key is null then
    return jsonb_build_object(
      'status','needs_family',
      'prescription_complete',prescription_complete,
      'missing_data',to_jsonb(missing),
      'technical_family_key',null,
      'technical_result',null,
      'final_supply_mode',null,
      'requires_human_review',false
    );
  end if;

  if not prescription_complete then
    return jsonb_build_object(
      'status','incomplete_prescription',
      'prescription_complete',false,
      'missing_data',to_jsonb(missing),
      'technical_family_key',p_family_key,
      'technical_result',null,
      'final_supply_mode',null,
      'requires_human_review',false
    );
  end if;

  pair_result := public.black_ai_resolve_pair_supply_mode(
    p_family_key,
    p_sphere_od,
    p_cylinder_od,
    p_sphere_oi,
    p_cylinder_oi
  );

  final_mode := pair_result->>'final_supply_mode';

  return jsonb_build_object(
    'status',case when pair_result->>'status'='needs_review' then 'needs_review' else 'resolved' end,
    'prescription_complete',true,
    'missing_data','[]'::jsonb,
    'technical_family_key',p_family_key,
    'technical_result',pair_result,
    'final_supply_mode',final_mode,
    'requires_human_review',(pair_result->>'status'='needs_review')
  );
end;
$$;

grant execute on function public.black_ai_evaluate_prescription_case(text,text,numeric,numeric,integer,numeric,numeric,integer,numeric) to authenticated;
grant execute on function public.black_ai_evaluate_prescription_case(text,text,numeric,numeric,integer,numeric,numeric,integer,numeric) to service_role;
revoke all on function public.black_ai_evaluate_prescription_case(text,text,numeric,numeric,integer,numeric,numeric,integer,numeric) from anon;

-- ------------------------------------------------------------
-- 3. PROXIMO DATO A PEDIR
-- ------------------------------------------------------------
-- Devuelve una CLAVE, no texto final. La IA redactará la pregunta de forma
-- natural según el contexto y evitando repetir datos ya obtenidos.
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
  od jsonb := coalesce(p_prescription->'od','{}'::jsonb);
  oi jsonb := coalesce(p_prescription->'oi','{}'::jsonb);
  add_value jsonb := p_prescription->'addition';
begin
  if p_objective is null then return 'clarify_objective'; end if;

  if p_objective in ('quote','buy','renew','prescription_quote') then
    if coalesce(p_prescription,'{}'::jsonb)='{}'::jsonb then return 'request_prescription'; end if;
    if not (od ? 'sphere') or not (od ? 'cylinder') or not (oi ? 'sphere') or not (oi ? 'cylinder') then
      return 'complete_prescription';
    end if;
    if coalesce((od->>'cylinder')::numeric,0)<>0 and not (od ? 'axis') then return 'request_axis_od'; end if;
    if coalesce((oi->>'cylinder')::numeric,0)<>0 and not (oi ? 'axis') then return 'request_axis_oi'; end if;
    if p_optical_case in ('bifocal','occupational','multifocal') and add_value is null then return 'request_addition'; end if;
    if p_optical_case is null then return 'clarify_optical_case'; end if;
    if p_main_use is null then return 'ask_main_use'; end if;
    if p_previous_lens_type is null and p_optical_case in ('occupational','multifocal') then return 'ask_previous_lens_experience'; end if;
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
-- EJEMPLO 1: evaluar receta completa
-- ============================================================
-- select public.black_ai_evaluate_prescription_case(
--   'organic_standard_149_156','monofocal',
--   -1.50,-0.50,90,
--   -1.25,-0.75,80,
--   null
-- );
--
-- EJEMPLO 2: obtener próxima pregunta
-- select public.black_ai_next_question_key(
--   'quote',
--   '{"od":{"sphere":-1.50,"cylinder":-0.50,"axis":90},"oi":{"sphere":-1.25,"cylinder":-0.75,"axis":80}}'::jsonb,
--   'monofocal',
--   null,
--   null,
--   'organic_standard_149_156',
--   '{}'::jsonb
-- );
-- Esperado: ask_main_use
-- ============================================================
