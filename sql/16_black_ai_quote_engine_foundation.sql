-- ============================================================
-- BLACK OS — BLACK AI
-- MOTOR DE COTIZACION — BASE TECNICA v1
-- ============================================================
-- Objetivo:
-- 1) Separar compatibilidad optica de la forma comercial de cotizar.
-- 2) Permitir receta -> productos compatibles -> tipo de cotizacion.
-- 3) No cargar precios ni rangos inventados: esos datos se completan con
--    las listas tecnicas/comerciales reales de Black Optica.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CAPA TECNICA DEL PRODUCTO
-- ------------------------------------------------------------

alter table public.black_ai_products
  add column if not exists optical_case text,
  add column if not exists supply_mode text,
  add column if not exists sphere_min numeric(8,2),
  add column if not exists sphere_max numeric(8,2),
  add column if not exists cylinder_min numeric(8,2),
  add column if not exists cylinder_max numeric(8,2),
  add column if not exists cylinder_abs_max numeric(8,2),
  add column if not exists addition_min numeric(8,2),
  add column if not exists addition_max numeric(8,2),
  add column if not exists axis_min integer default 0,
  add column if not exists axis_max integer default 180,
  add column if not exists requires_addition boolean not null default false,
  add column if not exists technical_priority integer not null default 100;

-- Valores esperados, sin imponerlos como enum rigido para poder ampliar luego:
-- optical_case: monofocal | bifocal | occupational | multifocal | other
-- supply_mode: stock | range_extended | laboratory

create index if not exists black_ai_products_optical_case_idx
  on public.black_ai_products (optical_case, is_active);

create index if not exists black_ai_products_supply_mode_idx
  on public.black_ai_products (supply_mode, is_active);

comment on column public.black_ai_products.optical_case is
'Caso optico principal: monofocal, bifocal, occupational, multifocal u otro.';

comment on column public.black_ai_products.supply_mode is
'Modalidad de provision: stock, range_extended o laboratory.';

comment on column public.black_ai_products.sphere_min is
'Esfera minima admitida por el producto. NULL = pendiente/no definida.';

comment on column public.black_ai_products.sphere_max is
'Esfera maxima admitida por el producto. NULL = pendiente/no definida.';

comment on column public.black_ai_products.cylinder_abs_max is
'Valor absoluto maximo de cilindro admitido cuando la tabla tecnica se expresa de esa forma.';

comment on column public.black_ai_products.requires_addition is
'Indica si el producto requiere adicion para ser candidato tecnico.';

-- ------------------------------------------------------------
-- 2. TIPOS / PERFILES DE COTIZACION
-- ------------------------------------------------------------
-- Esta tabla NO reemplaza Conocimiento.
-- Conocimiento contiene texto, argumentos comerciales, beneficios y forma
-- de comunicar. Esta tabla define la logica estructurada del caso.

create table if not exists public.black_ai_quote_profiles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  optical_case text,
  description text,
  option_count integer not null default 3,
  option_strategy jsonb not null default '[]'::jsonb,
  product_filters jsonb not null default '{}'::jsonb,
  knowledge_category text,
  requires_human_approval boolean not null default true,
  is_active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists black_ai_quote_profiles_case_idx
  on public.black_ai_quote_profiles (optical_case, is_active, priority);

comment on table public.black_ai_quote_profiles is
'Perfiles estructurados de cotizacion. Determinan que tipo de propuesta armar segun el caso; el texto comercial sigue viniendo de Conocimiento.';

comment on column public.black_ai_quote_profiles.option_strategy is
'Estrategia de opciones. Ejemplo futuro: [{"key":"economic"},{"key":"recommended"},{"key":"premium"}].';

comment on column public.black_ai_quote_profiles.product_filters is
'Filtros estructurados para seleccionar candidatos tecnicos/comerciales sin dejar la decision de precio a la IA.';

-- Casos base ya conversados. Se crean sin productos ni precios asociados.
insert into public.black_ai_quote_profiles
  (key, name, optical_case, description, option_count, knowledge_category, priority)
values
  ('monofocal', 'Monofocal', 'monofocal', 'Cotizacion para correccion monofocal.', 3, 'cotizacion_monofocal', 10),
  ('bifocal', 'Bifocal', 'bifocal', 'Cotizacion para receta bifocal.', 3, 'cotizacion_bifocal', 20),
  ('occupational', 'Ocupacional', 'occupational', 'Cotizacion para lente ocupacional/oficina.', 3, 'cotizacion_ocupacional', 30),
  ('multifocal', 'Multifocal', 'multifocal', 'Cotizacion para lente multifocal/progresivo.', 3, 'cotizacion_multifocal', 40),
  ('high_rx', 'Graduacion especial / laboratorio', null, 'Caso que requiere revisar disponibilidad o fabricacion especial.', 3, 'cotizacion_graduacion_especial', 50),
  ('second_unit', 'Segunda unidad', null, 'Cotizacion comercial de segunda unidad cuando corresponda.', 2, 'cotizacion_segunda_unidad', 60),
  ('agreement', 'Convenio', null, 'Cotizacion bajo condiciones de convenio cuando corresponda.', 3, 'cotizacion_convenio', 70)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 3. EVALUACIONES DE COTIZACION
-- ------------------------------------------------------------
-- Guarda el resultado del motor antes de que exista envio automatico.
-- Sirve para auditoria y aprobacion humana.

create table if not exists public.black_ai_quote_evaluations (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid references public.black_ai_inbox(id) on delete set null,
  phone text,
  profile_key text references public.black_ai_quote_profiles(key) on delete set null,
  prescription jsonb not null default '{}'::jsonb,
  technical_result jsonb not null default '{}'::jsonb,
  candidate_products jsonb not null default '[]'::jsonb,
  proposed_quote jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','needs_review','approved','rejected','sent')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists black_ai_quote_evaluations_inbox_idx
  on public.black_ai_quote_evaluations (inbox_id);

create index if not exists black_ai_quote_evaluations_status_idx
  on public.black_ai_quote_evaluations (status, created_at desc);

-- ------------------------------------------------------------
-- 4. SEGURIDAD / PERMISOS
-- ------------------------------------------------------------

alter table public.black_ai_quote_profiles enable row level security;
alter table public.black_ai_quote_evaluations enable row level security;

grant select, insert, update, delete on table public.black_ai_quote_profiles to authenticated;
grant select, insert, update, delete on table public.black_ai_quote_evaluations to authenticated;

grant select on table public.black_ai_products to service_role;
grant select on table public.black_ai_price_rules to service_role;
grant select on table public.black_ai_quote_profiles to service_role;
grant select, insert, update on table public.black_ai_quote_evaluations to service_role;

revoke all on table public.black_ai_quote_profiles from anon;
revoke all on table public.black_ai_quote_evaluations from anon;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='black_ai_quote_profiles'
      and policyname='black_ai_quote_profiles_auth_all'
  ) then
    create policy black_ai_quote_profiles_auth_all
      on public.black_ai_quote_profiles
      for all to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='black_ai_quote_evaluations'
      and policyname='black_ai_quote_evaluations_auth_all'
  ) then
    create policy black_ai_quote_evaluations_auth_all
      on public.black_ai_quote_evaluations
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- ============================================================
-- SIGUIENTE ETAPA
-- ============================================================
-- Cargar SOLO datos reales:
-- - optical_case y supply_mode de cada producto
-- - rangos de esfera/cilindro/adicion segun tabla tecnica
-- - precios vigentes segun lista comercial
-- - reglas comerciales de cada perfil
-- Luego: receta -> candidatos compatibles -> propuesta -> aprobacion humana.
-- ============================================================
