-- ============================================================
-- BLACK OS — BLACK AI
-- SEGUIMIENTOS COMERCIALES AUTOMATICOS v1
-- ============================================================
-- Objetivo:
-- 1) Definir escenarios configurables de seguimiento.
-- 2) Registrar oportunidades/pacientes pendientes.
-- 3) Registrar cada intento de seguimiento.
-- 4) Poder frenar automáticamente por respuesta, venta, baja u orden humana.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. ESCENARIOS DE SEGUIMIENTO
-- ------------------------------------------------------------
create table if not exists public.black_ai_followup_scenarios (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in (
    'quote_no_reply',
    'pending_confirmation',
    'interested_no_close',
    'custom'
  )),
  is_active boolean not null default false,
  send_mode text not null default 'assisted' check (send_mode in ('assisted','automatic')),
  initial_delay_hours integer not null default 24 check (initial_delay_hours >= 1),
  followup_delays_hours integer[] not null default array[24,72,168]::integer[],
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  stop_on_reply boolean not null default true,
  stop_on_sale boolean not null default true,
  stop_on_optout boolean not null default true,
  business_hours_start time not null default '09:00',
  business_hours_end time not null default '19:00',
  timezone text not null default 'America/Argentina/Cordoba',
  ai_instructions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. OPORTUNIDADES EN SEGUIMIENTO
-- ------------------------------------------------------------
create table if not exists public.black_ai_followup_opportunities (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.black_ai_followup_scenarios(id) on delete restrict,
  phone text not null,
  source_type text not null default 'conversation',
  source_id text,
  status text not null default 'waiting' check (status in (
    'waiting',
    'scheduled',
    'paused',
    'replied',
    'won',
    'lost',
    'opted_out',
    'completed',
    'cancelled'
  )),
  followup_count integer not null default 0,
  last_patient_message_at timestamptz,
  last_business_message_at timestamptz,
  last_followup_at timestamptz,
  next_followup_at timestamptz,
  pause_until timestamptz,
  context jsonb not null default '{}'::jsonb,
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists black_ai_followup_opportunities_due_idx
  on public.black_ai_followup_opportunities(status,next_followup_at)
  where status in ('waiting','scheduled');

create index if not exists black_ai_followup_opportunities_phone_idx
  on public.black_ai_followup_opportunities(phone,updated_at desc);

-- ------------------------------------------------------------
-- 3. HISTORIAL DE INTENTOS
-- ------------------------------------------------------------
create table if not exists public.black_ai_followup_attempts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.black_ai_followup_opportunities(id) on delete cascade,
  attempt_number integer not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text not null default 'pending' check (status in (
    'pending','prepared','sent','skipped','failed','cancelled'
  )),
  message_text text,
  skip_reason text,
  error_message text,
  provider_message_id text,
  ai_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(opportunity_id,attempt_number)
);

create index if not exists black_ai_followup_attempts_opportunity_idx
  on public.black_ai_followup_attempts(opportunity_id,attempt_number desc);

-- ------------------------------------------------------------
-- 4. RLS / PERMISOS
-- ------------------------------------------------------------
alter table public.black_ai_followup_scenarios enable row level security;
alter table public.black_ai_followup_opportunities enable row level security;
alter table public.black_ai_followup_attempts enable row level security;

grant select, insert, update, delete on public.black_ai_followup_scenarios to authenticated;
grant select, insert, update, delete on public.black_ai_followup_opportunities to authenticated;
grant select, insert, update, delete on public.black_ai_followup_attempts to authenticated;

grant select, insert, update on public.black_ai_followup_scenarios to service_role;
grant select, insert, update on public.black_ai_followup_opportunities to service_role;
grant select, insert, update on public.black_ai_followup_attempts to service_role;

revoke all on public.black_ai_followup_scenarios from anon;
revoke all on public.black_ai_followup_opportunities from anon;
revoke all on public.black_ai_followup_attempts from anon;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_followup_scenarios' and policyname='black_ai_followup_scenarios_auth_all') then
    create policy black_ai_followup_scenarios_auth_all on public.black_ai_followup_scenarios
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_followup_opportunities' and policyname='black_ai_followup_opportunities_auth_all') then
    create policy black_ai_followup_opportunities_auth_all on public.black_ai_followup_opportunities
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='black_ai_followup_attempts' and policyname='black_ai_followup_attempts_auth_all') then
    create policy black_ai_followup_attempts_auth_all on public.black_ai_followup_attempts
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. ESCENARIOS INICIALES
-- Quedan DESACTIVADOS hasta que se valide el flujo completo.
-- ------------------------------------------------------------
insert into public.black_ai_followup_scenarios (
  key,name,description,trigger_type,is_active,send_mode,
  initial_delay_hours,followup_delays_hours,max_attempts,ai_instructions
) values
(
  'quote_no_reply',
  'Cotización sin respuesta',
  'Paciente recibió una cotización y no volvió a responder.',
  'quote_no_reply',
  false,
  'assisted',
  24,
  array[24,72,168]::integer[],
  3,
  'Recordar la cotización sin presionar. Referenciar de forma breve la opción consultada y ofrecer ayuda para resolver dudas o avanzar.'
),
(
  'pending_confirmation',
  'Quedó en confirmar',
  'Paciente manifestó intención de confirmar más adelante y la conversación quedó pendiente.',
  'pending_confirmation',
  false,
  'assisted',
  24,
  array[24,72,168]::integer[],
  3,
  'Retomar el punto exacto que quedó pendiente. No repetir toda la cotización salvo que sea necesario.'
),
(
  'interested_no_close',
  'Interesado sin cierre',
  'Paciente mostró interés claro pero no concretó compra ni dejó una confirmación.',
  'interested_no_close',
  false,
  'assisted',
  48,
  array[48,120,240]::integer[],
  3,
  'Hacer seguimiento comercial amable, contextual y breve. Evitar sensación de insistencia o mensajes idénticos.'
)
on conflict (key) do nothing;

comment on table public.black_ai_followup_scenarios is
'Escenarios configurables que determinan cuándo y cómo Black AI puede hacer seguimientos comerciales.';
comment on table public.black_ai_followup_opportunities is
'Pacientes/conversaciones actualmente dentro de un recorrido de seguimiento comercial.';
comment on table public.black_ai_followup_attempts is
'Historial auditable de cada seguimiento preparado, enviado, omitido o fallido.';
