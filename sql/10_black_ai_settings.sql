-- ============================================================
-- BLACK OS — BLACK AI
-- CONFIGURACIÓN CENTRALIZADA v1
-- ============================================================

create table if not exists public.black_ai_settings (
    id text primary key,
    config jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    updated_by uuid
);

alter table public.black_ai_settings enable row level security;

-- Una única configuración global para CRM Black.
insert into public.black_ai_settings (id, config)
values ('global', '{}'::jsonb)
on conflict (id) do nothing;

-- La V1 permite acceso únicamente a usuarios autenticados del portal.
-- Más adelante podemos restringir escritura por rol/permisos de Black OS.
drop policy if exists black_ai_settings_select_authenticated on public.black_ai_settings;
create policy black_ai_settings_select_authenticated
on public.black_ai_settings
for select
to authenticated
using (id = 'global');

drop policy if exists black_ai_settings_insert_authenticated on public.black_ai_settings;
create policy black_ai_settings_insert_authenticated
on public.black_ai_settings
for insert
to authenticated
with check (id = 'global');

drop policy if exists black_ai_settings_update_authenticated on public.black_ai_settings;
create policy black_ai_settings_update_authenticated
on public.black_ai_settings
for update
to authenticated
using (id = 'global')
with check (id = 'global');

comment on table public.black_ai_settings is
'Configuración centralizada del asistente Black AI dentro de CRM Black.';
