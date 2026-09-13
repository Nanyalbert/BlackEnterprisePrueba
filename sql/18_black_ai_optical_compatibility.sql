-- ============================================================
-- BLACK OS — BLACK AI
-- COMPATIBILIDAD OPTICA DETERMINISTA v1
-- ============================================================
-- Objetivo:
-- receta -> productos compatibles / fuera de rango / ficha tecnica pendiente
--
-- Regla de seguridad:
-- un producto SIN ficha tecnica completa nunca se devuelve como compatible.
-- ============================================================

create or replace function public.black_ai_find_compatible_products(
  p_optical_case text,
  p_sphere_od numeric default null,
  p_cylinder_od numeric default null,
  p_sphere_oi numeric default null,
  p_cylinder_oi numeric default null,
  p_addition numeric default null
)
returns table (
  product_id uuid,
  product_name text,
  base_price numeric,
  optical_case text,
  supply_mode text,
  material text,
  treatment text,
  design text,
  compatibility_status text,
  compatibility_reason text,
  technical_priority integer
)
language sql
stable
security invoker
set search_path = public
as $$
with candidates as (
  select
    p.*,
    (
      p.sphere_min is not null
      and p.sphere_max is not null
      and (
        (p.cylinder_abs_max is not null)
        or (p.cylinder_min is not null and p.cylinder_max is not null)
      )
      and (
        coalesce(p.requires_addition,false) = false
        or (p.addition_min is not null and p.addition_max is not null)
      )
    ) as technical_ready
  from public.black_ai_products p
  where p.is_active = true
    and p.optical_case = p_optical_case
), evaluated as (
  select
    c.*,
    case
      when not c.technical_ready then 'technical_pending'
      when p_sphere_od is null or p_sphere_oi is null then 'needs_review'
      when p_sphere_od < c.sphere_min or p_sphere_od > c.sphere_max
        or p_sphere_oi < c.sphere_min or p_sphere_oi > c.sphere_max then 'out_of_range'
      when c.cylinder_abs_max is not null and (
        (p_cylinder_od is not null and abs(p_cylinder_od) > c.cylinder_abs_max)
        or (p_cylinder_oi is not null and abs(p_cylinder_oi) > c.cylinder_abs_max)
      ) then 'out_of_range'
      when c.cylinder_abs_max is null and (
        (p_cylinder_od is not null and (p_cylinder_od < c.cylinder_min or p_cylinder_od > c.cylinder_max))
        or (p_cylinder_oi is not null and (p_cylinder_oi < c.cylinder_min or p_cylinder_oi > c.cylinder_max))
      ) then 'out_of_range'
      when coalesce(c.requires_addition,false) = true and p_addition is null then 'needs_review'
      when coalesce(c.requires_addition,false) = true and (
        p_addition < c.addition_min or p_addition > c.addition_max
      ) then 'out_of_range'
      else 'compatible'
    end as compatibility_status
  from candidates c
)
select
  e.id,
  e.name,
  e.base_price,
  e.optical_case,
  e.supply_mode,
  e.material,
  e.treatment,
  e.design,
  e.compatibility_status,
  case
    when e.compatibility_status = 'technical_pending' then 'Falta completar la ficha tecnica del producto.'
    when e.compatibility_status = 'needs_review' then 'La receta no contiene todos los datos necesarios para validar automaticamente.'
    when e.compatibility_status = 'out_of_range' then 'La receta queda fuera del rango tecnico configurado.'
    else 'Compatible con los rangos tecnicos configurados.'
  end,
  e.technical_priority
from evaluated e
order by
  case e.compatibility_status
    when 'compatible' then 1
    when 'needs_review' then 2
    when 'technical_pending' then 3
    else 4
  end,
  e.technical_priority asc,
  e.base_price asc nulls last,
  e.name asc;
$$;

comment on function public.black_ai_find_compatible_products(text,numeric,numeric,numeric,numeric,numeric) is
'Motor determinista de compatibilidad receta-producto. Nunca marca como compatible un producto sin ficha tecnica completa.';

grant execute on function public.black_ai_find_compatible_products(text,numeric,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.black_ai_find_compatible_products(text,numeric,numeric,numeric,numeric,numeric) to service_role;
revoke all on function public.black_ai_find_compatible_products(text,numeric,numeric,numeric,numeric,numeric) from anon;

-- ============================================================
-- EJEMPLO DE PRUEBA (NO MODIFICA DATOS)
-- ============================================================
-- select * from public.black_ai_find_compatible_products(
--   'monofocal',
--   -1.50, -0.50,
--   -1.25, -0.75,
--   null
-- );
-- ============================================================
