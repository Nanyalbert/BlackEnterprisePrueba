-- ============================================================
-- BLACK OS — PROVEEDORES / ACCIONES OPERATIVAS
-- Migración 32 · 2026-10-05
-- Pagos, reposición y observaciones compartidos por período.
-- ============================================================

create table if not exists public.supplier_period_actions (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  provider text not null,
  paid numeric(14,2) not null default 0,
  replenished numeric(14,2) not null default 0,
  note text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period, provider)
);

create index if not exists supplier_period_actions_period_idx
  on public.supplier_period_actions(period, provider);

create or replace function public.black_supplier_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_supplier_period_actions_touch on public.supplier_period_actions;
create trigger trg_supplier_period_actions_touch
before update on public.supplier_period_actions
for each row execute function public.black_supplier_touch_updated_at();

alter table public.supplier_period_actions enable row level security;

drop policy if exists supplier_period_actions_select on public.supplier_period_actions;
create policy supplier_period_actions_select
on public.supplier_period_actions
for select to authenticated
using (
  coalesce((auth.jwt() -> 'app_metadata' ->> 'black_os_super_admin')::boolean, false)
  or (auth.jwt() -> 'app_metadata' -> 'black_os_apps') ? 'administracion'
);

drop policy if exists supplier_period_actions_write on public.supplier_period_actions;
create policy supplier_period_actions_write
on public.supplier_period_actions
for all to authenticated
using (
  coalesce((auth.jwt() -> 'app_metadata' ->> 'black_os_super_admin')::boolean, false)
  or (auth.jwt() -> 'app_metadata' -> 'black_os_apps') ? 'administracion'
)
with check (
  coalesce((auth.jwt() -> 'app_metadata' ->> 'black_os_super_admin')::boolean, false)
  or (auth.jwt() -> 'app_metadata' -> 'black_os_apps') ? 'administracion'
);

grant select, insert, update, delete on public.supplier_period_actions to authenticated;
grant all on public.supplier_period_actions to service_role;

select to_regclass('public.supplier_period_actions') is not null as supplier_actions_ready;
