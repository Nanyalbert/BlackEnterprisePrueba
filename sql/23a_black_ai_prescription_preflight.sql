-- ============================================================
-- BLACK OS — BLACK AI
-- PREFLIGHT RECETAS — SOLO LECTURA
-- ============================================================
-- NO modifica datos ni estructura.
-- Ejecutar antes de sql/23_black_ai_prescription_confirmation.sql
-- para verificar que la base real coincide con lo esperado por el repo.
-- ============================================================

-- 1) Columnas actuales del estado conversacional
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema='public'
  and table_name='black_ai_case_state'
order by ordinal_position;

-- 2) Restricciones actuales de la tabla
select
  c.conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid='public.black_ai_case_state'::regclass
order by c.conname;

-- 3) Firma(s) actuales de black_ai_next_question_key
select
  p.oid::regprocedure::text as signature,
  pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='black_ai_next_question_key';

-- 4) Prueba de solo lectura del bug de JSON null.
-- El comportamiento CORRECTO futuro es devolver complete_prescription.
select public.black_ai_next_question_key(
  'quote',
  '{"od":{"sphere":null,"cylinder":null,"axis":null},"oi":{"sphere":null,"cylinder":null,"axis":null}}'::jsonb,
  'monofocal',
  null,
  null,
  null,
  '{}'::jsonb
) as null_fields_test;

-- 5) Cantidad de estados existentes, sin exponer telefonos ni datos personales
select
  count(*) as total_case_states,
  count(*) filter (where prescription <> '{}'::jsonb) as states_with_prescription,
  count(*) filter (where technical_result <> '{}'::jsonb) as states_with_technical_result
from public.black_ai_case_state;
