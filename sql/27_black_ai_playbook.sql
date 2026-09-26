-- ============================================================
-- BLACK OS — BLACK AI
-- PLAYBOOK COMERCIAL / ENTRENAMIENTO DEL AGENTE
-- ============================================================
-- Objetivo:
-- Guardar ejemplos, criterios y reglas de atención de Black Óptica
-- para que el agente pueda recuperar "cómo responderíamos nosotros"
-- según el escenario, sin hardcodear cada respuesta en el orquestador.
-- ============================================================

create table if not exists public.black_ai_playbook (
  id uuid primary key default gen_random_uuid(),
  scenario text not null,
  title text not null,
  customer_example text,
  preferred_response text,
  principles text,
  tags text[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  is_active boolean not null default true,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists black_ai_playbook_scenario_idx
  on public.black_ai_playbook (scenario, is_active, priority);

create index if not exists black_ai_playbook_tags_gin_idx
  on public.black_ai_playbook using gin (tags);

create index if not exists black_ai_playbook_data_gin_idx
  on public.black_ai_playbook using gin (data);

create or replace function public.black_ai_playbook_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_black_ai_playbook_touch_updated_at
on public.black_ai_playbook;

create trigger trg_black_ai_playbook_touch_updated_at
before update on public.black_ai_playbook
for each row execute function public.black_ai_playbook_touch_updated_at();

alter table public.black_ai_playbook enable row level security;

drop policy if exists "black_ai_playbook_authenticated_read"
on public.black_ai_playbook;

create policy "black_ai_playbook_authenticated_read"
on public.black_ai_playbook
for select
to authenticated
using (true);

drop policy if exists "black_ai_playbook_authenticated_write"
on public.black_ai_playbook;

create policy "black_ai_playbook_authenticated_write"
on public.black_ai_playbook
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.black_ai_playbook to authenticated;
grant all on public.black_ai_playbook to service_role;
revoke all on public.black_ai_playbook from anon;

-- Escenarios sugeridos inicialmente:
-- first_contact
-- general_quote
-- no_prescription
-- first_time_multifocal
-- experienced_multifocal
-- brand_preference
-- budget_request
-- premium_request
-- price_objection
-- technical_question
-- buying_signal
-- followup
-- complaint

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='black_ai_playbook'
order by ordinal_position;
