-- Fase 1: catálogo independiente para Black Recetas. No modifica black_ai_products ni Crystal.
-- Ejecutar manualmente en el SQL Editor después de revisar permisos y backups.
create table if not exists public.black_rx_products (
 id uuid primary key default gen_random_uuid(),
 sku text not null unique,
 name text not null,
 category text not null check (category in ('monofocal','multifocal','bifocal','occupational')),
 material text,
 refractive_index numeric(3,2),
 treatment text,
 supplier text,
 description text,
 selling_points text,
 sphere_min numeric(6,2),
 sphere_max numeric(6,2),
 cylinder_min numeric(6,2),
 cylinder_max numeric(6,2),
 addition_min numeric(5,2),
 addition_max numeric(5,2),
 technical_notes text,
 priority integer not null default 50 check(priority between 0 and 100),
 price numeric(12,2) check(price is null or price >= 0),
 price_updated_at date,
 is_active boolean not null default false,
 technical_verified boolean not null default false,
 verified_at timestamptz,
 verified_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint rx_product_sphere_range check(sphere_min is null or sphere_max is null or sphere_min <= sphere_max),
 constraint rx_product_cylinder_range check(cylinder_min is null or cylinder_max is null or cylinder_min <= cylinder_max),
 constraint rx_product_add_range check(addition_min is null or addition_max is null or addition_min <= addition_max),
 constraint rx_product_verified_only_if_complete check(not technical_verified or
  (sphere_min is not null and sphere_max is not null and cylinder_min is not null and cylinder_max is not null
   and (category not in ('multifocal','bifocal') or (addition_min is not null and addition_max is not null))))
);
create index if not exists black_rx_products_active_idx on public.black_rx_products(is_active,category,priority);
alter table public.black_rx_products enable row level security;
grant select on public.black_rx_products to authenticated;
grant insert,update,delete on public.black_rx_products to authenticated;
drop policy if exists black_rx_products_read on public.black_rx_products;
create policy black_rx_products_read on public.black_rx_products for select to authenticated using(true);
drop policy if exists black_rx_products_insert on public.black_rx_products;
create policy black_rx_products_insert on public.black_rx_products for insert to authenticated
 with check (exists(select 1 from public.black_ai_scanner_admins a where a.user_id=auth.uid()));
drop policy if exists black_rx_products_update on public.black_rx_products;
create policy black_rx_products_update on public.black_rx_products for update to authenticated
 using (exists(select 1 from public.black_ai_scanner_admins a where a.user_id=auth.uid()))
 with check (exists(select 1 from public.black_ai_scanner_admins a where a.user_id=auth.uid()));
drop policy if exists black_rx_products_delete on public.black_rx_products;
create policy black_rx_products_delete on public.black_rx_products for delete to authenticated
 using (exists(select 1 from public.black_ai_scanner_admins a where a.user_id=auth.uid()));
-- Seguridad: los productos nuevos arrancan inactivos y sin verificación técnica.
-- La recomendación NO debe usar esta tabla hasta completar pruebas y la migración de fase 2.
