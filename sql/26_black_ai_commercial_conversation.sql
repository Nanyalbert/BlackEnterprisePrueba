-- ============================================================
-- BLACK OS — BLACK AI
-- METADATA COMERCIAL PARA CONOCIMIENTO — NO DESTRUCTIVO v2
-- ============================================================
-- IMPORTANTE:
-- Este script NO modifica el contenido redactado por Black Óptica.
-- Solo agrega metadata estructurada a entradas existentes para que
-- el orquestador pueda recuperarlas y aplicarlas con más precisión.
--
-- No inserta textos nuevos ni duplica reglas comerciales.
-- Idempotente: puede ejecutarse más de una vez.
-- ============================================================

-- Estilo global de cotización: conserva íntegramente el contenido actual.
update public.black_ai_knowledge
set
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'scope','global',
    'role','writing_style',
    'applies_to','all',
    'brief_description',true,
    'ask_only_when_needed',true
  ),
  updated_at = now()
where lower(trim(title)) = lower('Estilo de cotización Black Óptica');

-- Multifocales: conserva el texto existente y solo explicita el contexto.
update public.black_ai_knowledge
set
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'intent','prescription_lens_quote',
    'optical_case','multifocal',
    'scope','quote',
    'role','commercial_recommendation',
    'recommended_order',jsonb_build_array('ONE','NEW','FREE','AILENS'),
    'supports_preferences',true
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Multifocales Smart');

-- Filtro azul: solo etiqueta la regla ya existente, sin reescribirla.
update public.black_ai_knowledge
set
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'intent','prescription_lens_quote',
    'scope','quote',
    'role','commercial_preference',
    'treatment','blue_filter'
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Filtro Azul');

-- Verificación: muestra metadata y longitud del contenido para comprobar
-- que la información original sigue presente sin reemplazarla.
select
  title,
  category,
  priority,
  data,
  length(content) as content_length
from public.black_ai_knowledge
where lower(trim(title)) in (
  lower('Estilo de cotización Black Óptica'),
  lower('Cotización habitual · Multifocales Smart'),
  lower('Cotización habitual · Filtro Azul')
)
order by priority asc, title asc;
