-- ============================================================
-- BLACK OS — BLACK AI
-- MATRIZ TECNICA STOCK / RANGO EXTENDIDO v1
-- Fuente: Tabla de Rangos por Material - Grupo Optico
-- ============================================================
-- Esta capa reemplaza la aproximacion por min/max cuando la tabla real
-- depende de una combinacion exacta ESFERA x CILINDRO.
--
-- Convencion del documento fuente: cilindro negativo.
-- Si una receta llega con cilindro positivo, NO se transpone automaticamente:
-- se devuelve needs_review para revision humana.
-- ============================================================

alter table public.black_ai_products
  add column if not exists technical_family_key text;

create index if not exists black_ai_products_technical_family_idx
  on public.black_ai_products (technical_family_key, is_active);

create table if not exists public.black_ai_optical_matrix (
  id bigserial primary key,
  family_key text not null,
  family_name text not null,
  sphere numeric(6,2) not null,
  cylinder numeric(6,2) not null,
  supply_mode text not null check (supply_mode in ('stock','range_extended')),
  source_name text not null default 'Tabla de Rangos por Material - Grupo Optico',
  source_page integer,
  notes text,
  created_at timestamptz not null default now(),
  unique (family_key, sphere, cylinder)
);

create index if not exists black_ai_optical_matrix_lookup_idx
  on public.black_ai_optical_matrix (family_key, sphere, cylinder);

alter table public.black_ai_optical_matrix enable row level security;
grant select, insert, update, delete on table public.black_ai_optical_matrix to authenticated;
grant select on table public.black_ai_optical_matrix to service_role;
revoke all on table public.black_ai_optical_matrix from anon;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='black_ai_optical_matrix'
      and policyname='black_ai_optical_matrix_auth_all'
  ) then
    create policy black_ai_optical_matrix_auth_all
      on public.black_ai_optical_matrix
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- ------------------------------------------------------------
-- Limpieza idempotente de las familias incluidas en esta version
-- ------------------------------------------------------------
delete from public.black_ai_optical_matrix
where family_key in (
  'organic_standard_149_156',
  'photochromic_ar_156',
  'super_blue_mr8_160',
  'ultra_blue_174',
  'poly_white_159',
  'poly_ar_159'
);

-- Helper conceptual:
-- generate_series(inicio, fin, 0.25) para esfera y cilindro.
-- El cilindro se guarda exactamente como aparece en la receta / tabla: 0 a negativo.

-- ============================================================
-- PAGINA 2
-- ORGANICO BLANCO 1.499 / ORGANICO BLANCO C/AR 1.56 /
-- ORGANICO BLUE LIGHT C/AR 1.56
-- ============================================================

-- STOCK: esfera positiva 0.00 a +6.00, cilindro 0.00 a -2.00
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'organic_standard_149_156','Orgánico Blanco 1.499 / Blanco AR 1.56 / Blue Light AR 1.56',s,c,'stock',2
from generate_series(0.00::numeric,6.00::numeric,0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

-- STOCK: esfera negativa -0.25 a -6.00, cilindro 0.00 a -2.00
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'organic_standard_149_156','Orgánico Blanco 1.499 / Blanco AR 1.56 / Blue Light AR 1.56',s,c,'stock',2
from generate_series(-0.25::numeric,-6.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

-- RANGO EXTENDIDO: esfera positiva 0.00 a +4.25, cilindro -2.25 a -4.00
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'organic_standard_149_156','Orgánico Blanco 1.499 / Blanco AR 1.56 / Blue Light AR 1.56',s,c,'range_extended',2
from generate_series(0.00::numeric,4.25::numeric,0.25::numeric) s
cross join generate_series(-2.25::numeric,-4.00::numeric,-0.25::numeric) c;

-- RANGO EXTENDIDO: esfera negativa -0.25 a -4.00, cilindro -2.25 a -4.00
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'organic_standard_149_156','Orgánico Blanco 1.499 / Blanco AR 1.56 / Blue Light AR 1.56',s,c,'range_extended',2
from generate_series(-0.25::numeric,-4.00::numeric,-0.25::numeric) s
cross join generate_series(-2.25::numeric,-4.00::numeric,-0.25::numeric) c;

-- ============================================================
-- PAGINA 2 - ORGANICO FOTOCROMATICO C/AR 1.56
-- Solo STOCK en la tabla provista.
-- ============================================================
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'photochromic_ar_156','Orgánico Fotocromático C/AR 1.56',s,c,'stock',2
from generate_series(0.00::numeric,4.00::numeric,0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'photochromic_ar_156','Orgánico Fotocromático C/AR 1.56',s,c,'stock',2
from generate_series(-0.25::numeric,-4.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

-- ============================================================
-- PAGINA 3 - ORGANICO MR-8 SUPER BLUE LIGHT ASFERICO C/AR SHMC 1.6
-- ============================================================
-- Positivo: STOCK 0 a -2.00; RE -2.25 a -4.00 hasta +6.00.
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'super_blue_mr8_160','Orgánico MR-8 Super Blue Light Asférico C/AR SHMC 1.60',s,c,'stock',3
from generate_series(0.00::numeric,6.00::numeric,0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'super_blue_mr8_160','Orgánico MR-8 Super Blue Light Asférico C/AR SHMC 1.60',s,c,'range_extended',3
from generate_series(0.00::numeric,6.00::numeric,0.25::numeric) s
cross join generate_series(-2.25::numeric,-4.00::numeric,-0.25::numeric) c;

-- Negativo -0.25 a -6.00: STOCK 0 a -2.00 + RE -2.25 a -4.00.
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'super_blue_mr8_160','Orgánico MR-8 Super Blue Light Asférico C/AR SHMC 1.60',s,c,'stock',3
from generate_series(-0.25::numeric,-6.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'super_blue_mr8_160','Orgánico MR-8 Super Blue Light Asférico C/AR SHMC 1.60',s,c,'range_extended',3
from generate_series(-0.25::numeric,-6.00::numeric,-0.25::numeric) s
cross join generate_series(-2.25::numeric,-4.00::numeric,-0.25::numeric) c;

-- -6.25 a -7.00: toda la fila es R.E. (0 a -4.00).
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'super_blue_mr8_160','Orgánico MR-8 Super Blue Light Asférico C/AR SHMC 1.60',s,c,'range_extended',3
from generate_series(-6.25::numeric,-7.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-4.00::numeric,-0.25::numeric) c;

-- -7.25 a -10.00: R.E. 0 a -2.00.
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'super_blue_mr8_160','Orgánico MR-8 Super Blue Light Asférico C/AR SHMC 1.60',s,c,'range_extended',3
from generate_series(-7.25::numeric,-10.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

-- ============================================================
-- PAGINA 3 - ORGANICO ULTRA BLUE ASFERICO SHMC 1.74
-- Solo RANGO EXTENDIDO en la tabla provista.
-- ============================================================
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'ultra_blue_174','Orgánico Ultra Blue Asférico SHMC 1.74',s,c,'range_extended',3
from generate_series(-10.25::numeric,-12.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'ultra_blue_174','Orgánico Ultra Blue Asférico SHMC 1.74',s,0.00,'range_extended',3
from generate_series(-12.25::numeric,-15.00::numeric,-0.25::numeric) s;

-- ============================================================
-- PAGINA 4 - POLICARBONATO BLANCO 1.59
-- ============================================================
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'poly_white_159','Policarbonato Blanco 1.59',s,c,'stock',4
from generate_series(0.00::numeric,4.00::numeric,0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'poly_white_159','Policarbonato Blanco 1.59',s,c,'stock',4
from generate_series(-0.25::numeric,-4.00::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

-- ============================================================
-- PAGINA 4 - POLICARBONATO BLANCO C/AR 1.59
-- Se carga celda por celda segun la geometria escalonada de la tabla.
-- ============================================================
-- Bloque completo positivo hasta +4.25.
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'poly_ar_159','Policarbonato Blanco C/AR 1.59',s,c,'stock',4
from generate_series(0.00::numeric,4.25::numeric,0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

-- Extremo positivo: esfera 0.00 siempre disponible + banda de cilindro alto escalonada.
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
values
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',4.50, 0.00,'stock',4),
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',4.75, 0.00,'stock',4),
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',5.00, 0.00,'stock',4),
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',5.25, 0.00,'stock',4),
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',5.50, 0.00,'stock',4),
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',5.75, 0.00,'stock',4),
  ('poly_ar_159','Policarbonato Blanco C/AR 1.59',6.00, 0.00,'stock',4);

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'poly_ar_159','Policarbonato Blanco C/AR 1.59',v.sphere,c,'stock',4
from (values
  (4.50::numeric,-0.50::numeric),
  (4.75::numeric,-0.75::numeric),
  (5.00::numeric,-1.00::numeric),
  (5.25::numeric,-1.25::numeric),
  (5.50::numeric,-1.50::numeric),
  (5.75::numeric,-1.75::numeric),
  (6.00::numeric,-2.00::numeric)
) v(sphere,start_cylinder)
cross join lateral generate_series(v.start_cylinder,-2.00::numeric,-0.25::numeric) c;

-- Negativo: bloque completo hasta -4.25; luego solo cilindro 0 hasta -6.00.
insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'poly_ar_159','Policarbonato Blanco C/AR 1.59',s,c,'stock',4
from generate_series(-0.25::numeric,-4.25::numeric,-0.25::numeric) s
cross join generate_series(0.00::numeric,-2.00::numeric,-0.25::numeric) c;

insert into public.black_ai_optical_matrix (family_key,family_name,sphere,cylinder,supply_mode,source_page)
select 'poly_ar_159','Policarbonato Blanco C/AR 1.59',s,0.00,'stock',4
from generate_series(-4.50::numeric,-6.00::numeric,-0.25::numeric) s;

-- ============================================================
-- ASIGNACION DE FAMILIA TECNICA A PRODUCTOS IMPORTADOS
-- Solo reglas suficientemente especificas; no se pisa una asignacion futura manual.
-- ============================================================

update public.black_ai_products
set technical_family_key='super_blue_mr8_160'
where technical_family_key is null
  and upper(name) like '%SUPER BLUE%'
  and (upper(name) like '%1.60%' or upper(name) like '%1.6%');

update public.black_ai_products
set technical_family_key='ultra_blue_174'
where technical_family_key is null
  and upper(name) like '%ULTRA BLUE%'
  and upper(name) like '%1.74%';

update public.black_ai_products
set technical_family_key='photochromic_ar_156'
where technical_family_key is null
  and upper(name) like '%FOTOCROM%'
  and upper(name) like '%1.56%';

update public.black_ai_products
set technical_family_key='poly_ar_159'
where technical_family_key is null
  and upper(name) like '%POLICARBONATO%'
  and upper(name) like '%1.59%'
  and (upper(name) like '%C/AR%' or upper(name) like '%ANTIRREF%');

update public.black_ai_products
set technical_family_key='poly_white_159'
where technical_family_key is null
  and upper(name) like '%POLICARBONATO%'
  and upper(name) like '%1.59%'
  and upper(name) not like '%C/AR%'
  and upper(name) not like '%ANTIRREF%';

update public.black_ai_products
set technical_family_key='organic_standard_149_156'
where technical_family_key is null
  and (
    (upper(name) like '%ORGANICO BLANCO%' and (upper(name) like '%1.49%' or upper(name) like '%1.499%'))
    or (upper(name) like '%ORGANICO%C/ANTIRREF%' and upper(name) like '%1.56%' and upper(name) not like '%FOTOCROM%')
    or (upper(name) like '%BLUE LIGHT%' and upper(name) like '%1.56%' and upper(name) not like '%SUPER BLUE%' and upper(name) not like '%FOTOCROM%')
  );

-- ============================================================
-- RESOLUCION DE MODALIDAD PARA UN OJO
-- ============================================================
create or replace function public.black_ai_resolve_eye_supply_mode(
  p_family_key text,
  p_sphere numeric,
  p_cylinder numeric
)
returns table (
  status text,
  supply_mode text,
  reason text
)
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  v_mode text;
begin
  if p_family_key is null then
    return query select 'needs_review'::text,null::text,'El producto no tiene familia técnica asignada.'::text;
    return;
  end if;
  if p_sphere is null or p_cylinder is null then
    return query select 'needs_review'::text,null::text,'Faltan esfera o cilindro para evaluar el ojo.'::text;
    return;
  end if;
  if p_cylinder > 0 then
    return query select 'needs_review'::text,null::text,'La tabla técnica está expresada en cilindro negativo; no se transpone automáticamente.'::text;
    return;
  end if;

  select m.supply_mode into v_mode
  from public.black_ai_optical_matrix m
  where m.family_key=p_family_key
    and m.sphere=round(p_sphere*4)/4
    and m.cylinder=round(p_cylinder*4)/4
  limit 1;

  if v_mode is not null then
    return query select 'resolved'::text,v_mode,
      case when v_mode='stock' then 'La combinación esfera/cilindro figura en Stock.'
           else 'La combinación esfera/cilindro figura en Rango Extendido.' end::text;
  else
    return query select 'resolved'::text,'laboratory'::text,'La combinación no figura en Stock ni Rango Extendido: requiere laboratorio.'::text;
  end if;
end;
$$;

grant execute on function public.black_ai_resolve_eye_supply_mode(text,numeric,numeric) to authenticated;
grant execute on function public.black_ai_resolve_eye_supply_mode(text,numeric,numeric) to service_role;
revoke all on function public.black_ai_resolve_eye_supply_mode(text,numeric,numeric) from anon;

-- ============================================================
-- RESOLUCION DEL PAR OD/OI
-- La modalidad final es la más exigente entre ambos ojos.
-- stock < range_extended < laboratory
-- ============================================================
create or replace function public.black_ai_resolve_pair_supply_mode(
  p_family_key text,
  p_sphere_od numeric,
  p_cylinder_od numeric,
  p_sphere_oi numeric,
  p_cylinder_oi numeric
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  od record;
  oi record;
  final_mode text;
  rank_od integer;
  rank_oi integer;
begin
  select * into od from public.black_ai_resolve_eye_supply_mode(p_family_key,p_sphere_od,p_cylinder_od);
  select * into oi from public.black_ai_resolve_eye_supply_mode(p_family_key,p_sphere_oi,p_cylinder_oi);

  if od.status='needs_review' or oi.status='needs_review' then
    return jsonb_build_object(
      'status','needs_review',
      'family_key',p_family_key,
      'od',jsonb_build_object('status',od.status,'supply_mode',od.supply_mode,'reason',od.reason),
      'oi',jsonb_build_object('status',oi.status,'supply_mode',oi.supply_mode,'reason',oi.reason),
      'final_supply_mode',null
    );
  end if;

  rank_od=case od.supply_mode when 'stock' then 1 when 'range_extended' then 2 else 3 end;
  rank_oi=case oi.supply_mode when 'stock' then 1 when 'range_extended' then 2 else 3 end;
  final_mode=case greatest(rank_od,rank_oi) when 1 then 'stock' when 2 then 'range_extended' else 'laboratory' end;

  return jsonb_build_object(
    'status','resolved',
    'family_key',p_family_key,
    'od',jsonb_build_object('status',od.status,'supply_mode',od.supply_mode,'reason',od.reason),
    'oi',jsonb_build_object('status',oi.status,'supply_mode',oi.supply_mode,'reason',oi.reason),
    'final_supply_mode',final_mode
  );
end;
$$;

grant execute on function public.black_ai_resolve_pair_supply_mode(text,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.black_ai_resolve_pair_supply_mode(text,numeric,numeric,numeric,numeric) to service_role;
revoke all on function public.black_ai_resolve_pair_supply_mode(text,numeric,numeric,numeric,numeric) from anon;

-- ============================================================
-- NOTA SOBRE PAGINA 5
-- Mineral Blanco 1.523 y Mineral Fotocromático 1.523 muestran varias zonas
-- por color con leyendas que NO están identificadas como Stock / Rango Extendido.
-- Se dejan fuera de esta carga hasta confirmar qué representa cada color.
-- No se inventa equivalencia.
-- ============================================================

-- PRUEBAS DE EJEMPLO:
-- select public.black_ai_resolve_pair_supply_mode('organic_standard_149_156',-1.50,-0.50,-1.25,-0.75);
-- select public.black_ai_resolve_pair_supply_mode('super_blue_mr8_160',-6.50,-3.00,-7.50,-1.50);
