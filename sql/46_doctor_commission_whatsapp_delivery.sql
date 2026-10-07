-- Black OS · Entrega digital de liquidaciones médicas por WhatsApp
-- La base comisionable de prescriptions.amount es SIEMPRE monto neto / sin IVA.
-- Evolution API recibe un PDF generado en servidor y el envío se audita en estas tablas.

alter table public.prescriptions
  add column if not exists vat_rate numeric(5,2) not null default 21
  check (vat_rate >= 0 and vat_rate <= 100);

create table if not exists public.doctor_commission_deliveries (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  period_from date not null,
  period_to date not null,
  destination_phone text not null,
  status text not null default 'preparing'
    check (status in ('preparing','sent','failed')),
  prescription_count integer not null default 0,
  total_net numeric(14,2) not null default 0,
  total_vat numeric(14,2) not null default 0,
  total_gross numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  provider text not null default 'evolution',
  provider_message_id text null,
  provider_payload jsonb not null default '{}'::jsonb,
  error_message text null,
  sent_at timestamptz null,
  sent_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_to >= period_from)
);

create table if not exists public.doctor_commission_delivery_lines (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.doctor_commission_deliveries(id) on delete cascade,
  prescription_id uuid null references public.prescriptions(id) on delete set null,
  prescription_date date not null,
  patient_name text not null,
  amount_net numeric(14,2) not null,
  vat_rate numeric(5,2) not null,
  vat_amount numeric(14,2) not null,
  amount_gross numeric(14,2) not null,
  commission_percentage numeric(6,3) not null,
  commission_amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists doctor_commission_deliveries_lookup_idx
  on public.doctor_commission_deliveries(doctor_id,branch_id,period_from,period_to,created_at desc);
create index if not exists doctor_commission_deliveries_branch_idx
  on public.doctor_commission_deliveries(branch_id,created_at desc);
create index if not exists doctor_commission_deliveries_status_idx
  on public.doctor_commission_deliveries(status,created_at desc);
create index if not exists doctor_commission_deliveries_sent_by_idx
  on public.doctor_commission_deliveries(sent_by) where sent_by is not null;
create index if not exists doctor_commission_delivery_lines_delivery_idx
  on public.doctor_commission_delivery_lines(delivery_id);
create index if not exists doctor_commission_delivery_lines_prescription_idx
  on public.doctor_commission_delivery_lines(prescription_id) where prescription_id is not null;

alter table public.doctor_commission_deliveries enable row level security;
alter table public.doctor_commission_delivery_lines enable row level security;
revoke all on public.doctor_commission_deliveries from public,anon,authenticated;
revoke all on public.doctor_commission_delivery_lines from public,anon,authenticated;

drop policy if exists doctor_commission_deliveries_no_direct_access
  on public.doctor_commission_deliveries;
create policy doctor_commission_deliveries_no_direct_access
  on public.doctor_commission_deliveries for all to authenticated
  using(false) with check(false);

drop policy if exists doctor_commission_delivery_lines_no_direct_access
  on public.doctor_commission_delivery_lines;
create policy doctor_commission_delivery_lines_no_direct_access
  on public.doctor_commission_delivery_lines for all to authenticated
  using(false) with check(false);

create or replace function public.doctor_commission_delivery_status(
  p_period_from date,
  p_period_to date
)
returns table(
  doctor_id uuid,
  doctor_name text,
  branch_code text,
  status text,
  destination_phone text,
  sent_at timestamptz,
  commission_amount numeric,
  provider_message_id text
)
language sql
stable
security definer
set search_path=public
as $$
  select distinct on (d.doctor_id,d.branch_id)
    d.doctor_id,doc.full_name,b.code,d.status,d.destination_phone,d.sent_at,
    d.commission_amount,d.provider_message_id
  from public.doctor_commission_deliveries d
  join public.doctors doc on doc.id=d.doctor_id
  join public.branches b on b.id=d.branch_id
  where d.period_from=p_period_from
    and d.period_to=p_period_to
    and public.black_os_has_permission('crm-oftalmologos','stats')
    and public.black_os_branch_allowed(b.code)
  order by d.doctor_id,d.branch_id,d.created_at desc;
$$;

revoke all on function public.doctor_commission_delivery_status(date,date)
  from public,anon;
grant execute on function public.doctor_commission_delivery_status(date,date)
  to authenticated;
