-- ============================================================
-- BLACK OS — BLACK AI
-- CONOCIMIENTO ESTRUCTURADO PARA ROUTING COMERCIAL v1
-- ============================================================
-- Objetivo:
-- - Dar contexto explícito a las reglas comerciales ya cargadas.
-- - Evitar que Black AI tenga que adivinar por título/texto cuándo aplicarlas.
-- - Mantener intacto el contenido redactado por Black Óptica.
--
-- Idempotente: puede ejecutarse más de una vez.
-- ============================================================

update public.black_ai_knowledge
set
  category = 'commercial',
  priority = 5,
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'scope','global',
    'role','writing_style',
    'applies_to','all'
  ),
  updated_at = now()
where lower(trim(title)) = lower('Estilo de cotización Black Óptica');

update public.black_ai_knowledge
set
  priority = 10,
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'intent','prescription_lens_quote',
    'optical_case','multifocal',
    'scope','quote',
    'role','commercial_recommendation',
    'recommended_order',jsonb_build_array('ONE','NEW','FREE','AILENS')
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Multifocales Smart');

update public.black_ai_knowledge
set
  priority = 10,
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'intent','prescription_lens_quote',
    'optical_case','monofocal',
    'supply_mode','stock',
    'scope','quote',
    'role','commercial_recommendation'
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Monofocal Stock');

update public.black_ai_knowledge
set
  priority = 10,
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'intent','prescription_lens_quote',
    'optical_case','monofocal',
    'supply_mode','range_extended',
    'scope','quote',
    'role','commercial_recommendation'
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Monofocal R.E.');

update public.black_ai_knowledge
set
  priority = 20,
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'intent','prescription_lens_quote',
    'treatment','blue_filter',
    'scope','quote',
    'role','commercial_preference'
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Filtro Azul');

-- Verificación final
select
  title,
  category,
  priority,
  data
from public.black_ai_knowledge
where lower(title) in (
  lower('Estilo de cotización Black Óptica'),
  lower('Cotización habitual · Multifocales Smart'),
  lower('Cotización habitual · Monofocal Stock'),
  lower('Cotización habitual · Monofocal R.E.'),
  lower('Cotización habitual · Filtro Azul')
)
order by priority asc, title asc;
