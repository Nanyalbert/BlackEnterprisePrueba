-- ============================================================
-- BLACK OS — EJECUCIÓN DE CONTENIDOS
-- Migración 31 · 2026-10-05
-- Ejecutar después de sql/29_marketing_module.sql
-- ============================================================

alter table public.marketing_contents
  add column if not exists execution_status text not null default 'pending'
    check (execution_status in ('pending','done','not_done')),
  add column if not exists executed_at timestamptz,
  add column if not exists execution_note text;

create index if not exists marketing_contents_execution_idx
  on public.marketing_contents(execution_status, publish_date)
  where archived_at is null;

-- Normalización inicial: contenidos ya publicados o analizados se consideran realizados.
update public.marketing_contents
set execution_status='done',
    executed_at=coalesce(executed_at, updated_at, created_at)
where execution_status='pending'
  and status_id in ('published','analyzed');

select
  count(*) filter (where execution_status='pending') as pending,
  count(*) filter (where execution_status='done') as done,
  count(*) filter (where execution_status='not_done') as not_done
from public.marketing_contents;
