-- ============================================================
-- BLACK OS — BLACK AI
-- MOTOR DE PRECIOS / COTIZACION v1
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.black_ai_products (
    id uuid primary key default gen_random_uuid(),
    sku text,
    name text not null,
    family text,
    design text,
    material text,
    treatment text,
    supplier text,
    description text,
    currency text not null default 'ARS',
    base_price numeric(14,2),
    is_active boolean not null default true,
    valid_from date,
    valid_until date,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid,
    updated_by uuid
);

create index if not exists black_ai_products_name_idx on public.black_ai_products (lower(name));
create index if not exists black_ai_products_active_idx on public.black_ai_products (is_active, family);

create table if not exists public.black_ai_price_rules (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.black_ai_products(id) on delete cascade,
    rule_name text not null,
    priority integer not null default 100,
    conditions jsonb not null default '{}'::jsonb,
    result_type text not null default 'fixed' check (result_type in ('fixed','surcharge','multiplier','requires_quote')),
    amount numeric(14,2),
    multiplier numeric(12,6),
    currency text not null default 'ARS',
    notes text,
    is_active boolean not null default true,
    valid_from date,
    valid_until date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid,
    updated_by uuid
);

create index if not exists black_ai_price_rules_product_idx on public.black_ai_price_rules (product_id, is_active, priority);

create table if not exists public.black_ai_import_batches (
    id uuid primary key default gen_random_uuid(),
    source_name text not null,
    source_type text not null check (source_type in ('xlsx','xls','csv','pdf','manual')),
    status text not null default 'draft' check (status in ('draft','review','approved','rejected','completed')),
    summary jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    created_by uuid
);

create table if not exists public.black_ai_import_rows (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid not null references public.black_ai_import_batches(id) on delete cascade,
    row_number integer,
    raw_data jsonb not null default '{}'::jsonb,
    normalized_data jsonb not null default '{}'::jsonb,
    row_type text not null default 'product' check (row_type in ('product','price_rule','knowledge','ignore')),
    status text not null default 'pending' check (status in ('pending','approved','rejected','imported','error')),
    error_message text,
    created_at timestamptz not null default now()
);

alter table public.black_ai_products enable row level security;
alter table public.black_ai_price_rules enable row level security;
alter table public.black_ai_import_batches enable row level security;
alter table public.black_ai_import_rows enable row level security;

grant select, insert, update, delete on table public.black_ai_products to authenticated;
grant select, insert, update, delete on table public.black_ai_price_rules to authenticated;
grant select, insert, update, delete on table public.black_ai_import_batches to authenticated;
grant select, insert, update, delete on table public.black_ai_import_rows to authenticated;

revoke all on table public.black_ai_products from anon;
revoke all on table public.black_ai_price_rules from anon;
revoke all on table public.black_ai_import_batches from anon;
revoke all on table public.black_ai_import_rows from anon;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_products' and policyname='black_ai_products_auth_all') then
    create policy black_ai_products_auth_all on public.black_ai_products for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_price_rules' and policyname='black_ai_price_rules_auth_all') then
    create policy black_ai_price_rules_auth_all on public.black_ai_price_rules for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_import_batches' and policyname='black_ai_import_batches_auth_all') then
    create policy black_ai_import_batches_auth_all on public.black_ai_import_batches for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_import_rows' and policyname='black_ai_import_rows_auth_all') then
    create policy black_ai_import_rows_auth_all on public.black_ai_import_rows for all to authenticated using (true) with check (true);
  end if;
end $$;

comment on table public.black_ai_products is 'Catalogo estructurado de productos para Black AI.';
comment on table public.black_ai_price_rules is 'Reglas deterministicas de precio segun receta, material, tratamiento y otras condiciones.';
comment on column public.black_ai_price_rules.conditions is
'JSON flexible. Ejemplo: {"sphere_min":-4,"sphere_max":4,"cylinder_abs_max":2,"addition_min":1,"addition_max":3,"material":"1.60","treatment":"AR"}';
