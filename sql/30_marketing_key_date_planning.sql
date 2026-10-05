-- ============================================================
-- BLACK OS — PLANIFICACIÓN DE FECHAS CLAVE DE MARKETING
-- Migración 30 · 2026-10-05
-- Ejecutar después de sql/29_marketing_module.sql
-- ============================================================

create table if not exists public.marketing_key_date_plans (
  id uuid primary key default gen_random_uuid(),
  stable_id text not null unique,
  event_date date not null,
  title text not null,
  status text not null default 'unstarted'
    check (status in ('unstarted','strategy','production','campaign_ready','ready','executed','analyzed')),
  owner text,
  notes text,
  planning jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_key_date_plans_date_idx
  on public.marketing_key_date_plans(event_date, status);

drop trigger if exists trg_marketing_key_date_plans_touch on public.marketing_key_date_plans;
create trigger trg_marketing_key_date_plans_touch
before update on public.marketing_key_date_plans
for each row execute function public.black_marketing_touch_updated_at();

drop trigger if exists trg_marketing_key_date_plans_audit on public.marketing_key_date_plans;
create trigger trg_marketing_key_date_plans_audit
after insert or update or delete on public.marketing_key_date_plans
for each row execute function public.black_marketing_audit();

alter table public.marketing_key_date_plans enable row level security;

drop policy if exists marketing_key_date_plans_authenticated_select on public.marketing_key_date_plans;
create policy marketing_key_date_plans_authenticated_select
on public.marketing_key_date_plans
for select to authenticated
using (true);

drop policy if exists marketing_key_date_plans_authenticated_write on public.marketing_key_date_plans;
create policy marketing_key_date_plans_authenticated_write
on public.marketing_key_date_plans
for all to authenticated
using (true)
with check (true);

revoke all on public.marketing_key_date_plans from anon;
grant select, insert, update, delete on public.marketing_key_date_plans to authenticated;
grant all on public.marketing_key_date_plans to service_role;

select
  to_regclass('public.marketing_key_date_plans') is not null as key_date_planning_ready;
