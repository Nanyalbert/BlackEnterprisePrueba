-- ============================================================
-- BLACK OS — BLACK AI
-- DETECCION DE COTIZACION DESDE CASE STATE v1
-- ============================================================
-- Complementa la detección del webhook: cuando el orquestador genera
-- una respuesta de precio basada en catálogo, crea/actualiza automáticamente
-- la oportunidad "Cotización sin respuesta".
-- ============================================================

create or replace function public.black_ai_sync_quote_followup_from_case()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_scenario public.black_ai_followup_scenarios%rowtype;
  v_existing_id uuid;
  v_price_request text;
  v_price_snapshot jsonb;
  v_reply text;
  v_next timestamptz;
begin
  v_price_request := coalesce(new.next_best_question_context->>'price_request','none');
  v_price_snapshot := new.next_best_question_context->'price_snapshot';
  v_reply := coalesce(new.next_best_question_context->>'generated_reply','');

  -- Solo consideramos cotización cuando hubo una consulta de precio
  -- y el motor logró obtener valores reales del catálogo.
  if v_price_request = 'none'
     or v_price_snapshot is null
     or v_price_snapshot = 'null'::jsonb then
    return new;
  end if;

  select * into v_scenario
  from public.black_ai_followup_scenarios
  where key='quote_no_reply'
    and is_active=true
  limit 1;

  if v_scenario.id is null then
    return new;
  end if;

  v_next := now() + make_interval(hours => greatest(1,coalesce(v_scenario.initial_delay_hours,24)));

  select id into v_existing_id
  from public.black_ai_followup_opportunities
  where phone=new.phone
    and scenario_id=v_scenario.id
    and status in ('waiting','scheduled','paused')
  order by updated_at desc
  limit 1;

  if v_existing_id is not null then
    update public.black_ai_followup_opportunities
    set status='scheduled',
        last_business_message_at=now(),
        next_followup_at=v_next,
        stop_reason=null,
        context=coalesce(context,'{}'::jsonb) || jsonb_build_object(
          'trigger','case_price_snapshot',
          'price_request',v_price_request,
          'price_snapshot',v_price_snapshot,
          'generated_reply',left(v_reply,1600),
          'case_state_id',new.id,
          'detected_at',now(),
          'detector_version',2
        ),
        updated_at=now()
    where id=v_existing_id;
  else
    insert into public.black_ai_followup_opportunities(
      scenario_id,phone,source_type,source_id,status,followup_count,
      last_business_message_at,next_followup_at,context,created_at,updated_at
    ) values (
      v_scenario.id,
      new.phone,
      'case_price_snapshot',
      new.id::text,
      'scheduled',
      0,
      now(),
      v_next,
      jsonb_build_object(
        'trigger','case_price_snapshot',
        'price_request',v_price_request,
        'price_snapshot',v_price_snapshot,
        'generated_reply',left(v_reply,1600),
        'case_state_id',new.id,
        'detected_at',now(),
        'detector_version',2
      ),
      now(),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists black_ai_case_state_quote_followup_trg
on public.black_ai_case_state;

create trigger black_ai_case_state_quote_followup_trg
after insert or update of next_best_question_context
on public.black_ai_case_state
for each row
execute function public.black_ai_sync_quote_followup_from_case();

comment on function public.black_ai_sync_quote_followup_from_case() is
'Crea o actualiza una oportunidad quote_no_reply cuando Black AI obtiene un price_snapshot real durante una conversación.';
