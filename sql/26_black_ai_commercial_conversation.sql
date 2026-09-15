-- ============================================================
-- BLACK OS — BLACK AI
-- PULIDO COMERCIAL: DESCRIPCIONES + PREFERENCIAS + FORMATO v1
-- ============================================================
-- Objetivos:
-- 1) Evitar cotizaciones secas que sean solo nombre + precio.
-- 2) Evitar asteriscos/markdown literal en listados generales.
-- 3) Recordar que el paciente puede tener preferencias de marca/tratamiento.
-- 4) No reducir la oferta a filtro azul: contemplar AR, fotocromático,
--    alto índice, materiales y otras variantes activas del Catálogo.
-- 5) No asumir preferencias ni condición de primer usuario.
-- ============================================================

update public.black_ai_knowledge
set
  content = 'Para consultas generales de multifocales, presentar habitualmente las familias en este orden: Smart ONE — económico y funcional; Smart NEW — orientado especialmente a primeros usuarios, sin asumir que el paciente lo sea; Smart FREE (2x1) — equilibrio en todas las distancias; Smart Ailens (IA) — máxima personalización con tecnología avanzada. Dar una descripción breve de cada alternativa antes o junto al valor. No afirmar que una opción es la recomendada para ese paciente hasta conocer sus necesidades y preferencias. Además de la versión base, pueden existir variantes con antirreflejo, filtro de luz azul, fotocromático, alto índice y otros materiales/tratamientos disponibles en el Catálogo. Si el paciente manifiesta preferencia de marca, tratamiento o material, tenerla en cuenta antes de recomendar. Los precios vigentes siempre salen del Catálogo.',
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'descriptions', jsonb_build_object(
      'ONE','Económico y funcional',
      'NEW','Orientado especialmente a primeros usuarios',
      'FREE','Equilibrio en todas las distancias · 2x1',
      'AILENS','Máxima personalización con tecnología avanzada'
    ),
    'supported_preferences', jsonb_build_array(
      'brand','antireflective','blue_filter','photochromic','high_index','material'
    )
  ),
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Multifocales Smart');

update public.black_ai_knowledge
set
  content = 'Estilo de cotización por WhatsApp: claro, humano, breve y fácil de leer. En una consulta general de precios, mostrar nombre de la opción, una descripción corta y el precio vigente del Catálogo. No usar asteriscos literales ni sintaxis Markdown que pueda verse como caracteres en WhatsApp. No llenar el mensaje de símbolos. No terminar siempre con una pregunta: preguntar únicamente cuando haga falta un dato para personalizar o avanzar. Nunca asumir que el paciente es primer usuario, que quiere filtro azul, que prefiere una marca o que tiene un presupuesto determinado. Si pide recomendación, descubrir de a una sus necesidades y preferencias.',
  data = coalesce(data,'{}'::jsonb) || jsonb_build_object(
    'whatsapp_format','plain_readable',
    'literal_markdown',false,
    'brief_description',true,
    'ask_only_when_needed',true
  ),
  updated_at = now()
where lower(trim(title)) = lower('Estilo de cotización Black Óptica');

insert into public.black_ai_knowledge (
  category,title,content,priority,is_active,data
)
select
  'commercial',
  'Descubrimiento comercial · Preferencias de lentes',
  'Cuando el paciente solicite una recomendación personalizada, considerar sus preferencias antes de elegir un producto. Las preferencias pueden incluir marca, antirreflejo, filtro de luz azul, fotocromático, alto índice, material y otras características disponibles en el Catálogo. No limitar la conversación al filtro azul. No asumir ninguna preferencia: si es relevante, preguntar de a una cosa por vez y solo cuando cambie la recomendación. Si el paciente simplemente pregunta precios generales, primero responder la consulta y luego ofrecer personalizar según sus preferencias si lo desea. Si menciona una marca concreta, conservar esa preferencia y buscar alternativas compatibles de esa marca cuando el Catálogo permita identificarla.',
  15,
  true,
  jsonb_build_object(
    'scope','quote',
    'role','preference_discovery',
    'supported_preferences',jsonb_build_array('brand','antireflective','blue_filter','photochromic','high_index','material'),
    'ask_one_at_a_time',true,
    'do_not_assume',true
  )
where not exists (
  select 1 from public.black_ai_knowledge
  where lower(trim(title)) = lower('Descubrimiento comercial · Preferencias de lentes')
);

update public.black_ai_knowledge
set
  content = 'Cuando el paciente consulte específicamente por filtro de luz azul, priorizar alternativas técnicamente compatibles con Filtro Azul. Mostrar primero la opción estándar y luego alto índice Premium si corresponde técnicamente. No asumir filtro azul si el paciente no lo pidió. Recordar que también pueden existir alternativas con antirreflejo, fotocromático, alto índice u otros tratamientos/materiales activos en el Catálogo. No afirmar beneficios no aprobados. Usar únicamente precios vigentes del Catálogo.',
  updated_at = now()
where lower(trim(title)) = lower('Cotización habitual · Filtro Azul');

select title, category, priority, data, content
from public.black_ai_knowledge
where lower(trim(title)) in (
  lower('Estilo de cotización Black Óptica'),
  lower('Cotización habitual · Multifocales Smart'),
  lower('Descubrimiento comercial · Preferencias de lentes'),
  lower('Cotización habitual · Filtro Azul')
)
order by priority asc, title asc;
