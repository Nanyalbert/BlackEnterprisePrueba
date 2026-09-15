-- ============================================================
-- BLACK OS — BLACK AI
-- PREFLIGHT COTIZACION + CONOCIMIENTO — SOLO LECTURA
-- ============================================================
-- Objetivo: ver exactamente qué información real tiene Supabase
-- antes de cambiar el motor de recomendaciones/cotización.
-- NO modifica datos ni estructura.
-- ============================================================

-- 1) Conocimiento activo/vigente relacionado a multifocales, cotización y estilo
select
  id,
  category,
  title,
  priority,
  is_active,
  valid_from,
  valid_until,
  content,
  data
from public.black_ai_knowledge
where is_active = true
  and (valid_from is null or valid_from <= current_date)
  and (valid_until is null or valid_until >= current_date)
  and (
    lower(title) like '%multifocal%'
    or lower(content) like '%multifocal%'
    or lower(title) like '%cotiz%'
    or lower(content) like '%cotiz%'
    or lower(title) like '%estilo%'
    or lower(content) like '%smart one%'
    or lower(content) like '%smart new%'
    or lower(content) like '%smart free%'
    or lower(content) like '%ailens%'
  )
order by priority asc, updated_at desc;

-- 2) Productos multifocales activos que hoy puede ver Black AI
select
  id,
  name,
  design,
  material,
  treatment,
  optical_case,
  supply_mode,
  base_price,
  currency,
  valid_from,
  valid_until,
  is_active,
  metadata
from public.black_ai_products
where is_active = true
  and family = 'lens'
  and optical_case = 'multifocal'
  and (valid_from is null or valid_from <= current_date)
  and (valid_until is null or valid_until >= current_date)
order by base_price asc nulls last, name asc;

-- 3) Duplicados activos potenciales en multifocales
select
  lower(trim(coalesce(name,''))) as normalized_name,
  lower(trim(coalesce(design,''))) as normalized_design,
  count(*) as active_rows,
  array_agg(id order by updated_at desc) as ids,
  array_agg(base_price order by updated_at desc) as prices
from public.black_ai_products
where is_active = true
  and family = 'lens'
  and optical_case = 'multifocal'
group by 1,2
having count(*) > 1
order by active_rows desc, normalized_name;

-- 4) Configuración actual del asistente (sin secretos)
select
  config ->> 'tone' as tone,
  config ->> 'length' as length,
  config ->> 'emoji' as emoji,
  config ->> 'replyMode' as reply_mode,
  config ->> 'environment' as environment,
  config ->> 'scope' as scope
from public.black_ai_settings
where id = 'global';
