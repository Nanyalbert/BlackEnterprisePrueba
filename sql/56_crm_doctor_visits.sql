-- CRM: visitas manuales por profesional, independientes de horarios y comisiones.
create table public.doctor_visits (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  visited_at timestamptz not null default now(),
  visit_date date not null default (now() at time zone 'America/Argentina/Cordoba')::date,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  unique (doctor_id, visit_date)
);
create index doctor_visits_created_by_idx on public.doctor_visits(created_by);
alter table public.doctor_visits enable row level security;
revoke all on public.doctor_visits from anon, authenticated;
grant select, insert on public.doctor_visits to authenticated;
create policy doctor_visits_read on public.doctor_visits for select to authenticated
using ((select public.black_os_has_module('crm-oftalmologos')));
create policy doctor_visits_insert on public.doctor_visits for insert to authenticated
with check (
  created_by = (select auth.uid())
  and ((select public.black_os_has_permission('crm-oftalmologos','manage'))
    or (select public.black_os_has_permission('crm-oftalmologos','referrals')))
  and visit_date = (now() at time zone 'America/Argentina/Cordoba')::date
  and visited_at = now()
  and exists (select 1 from public.doctors d where d.id = doctor_id and d.active is not false)
);
-- Security invoker: conserva permisos del CRM y el alcance de sucursales de pagos.
create function public.crm_doctor_last_visits()
returns table (doctor_id uuid, visited_at timestamptz, source text)
language sql stable security invoker set search_path = public
as $$
  select distinct on (events.doctor_id) events.doctor_id, events.visited_at, events.source
  from (
    select v.doctor_id, v.visited_at, 'visit'::text as source from public.doctor_visits v
    union all
    select p.doctor_id, p.paid_at, 'payment'::text
    from public.doctor_commission_payments p
    where p.payment_status = 'paid' and p.paid_at is not null
  ) events
  where events.visited_at <= now()
  order by events.doctor_id, events.visited_at desc, events.source desc;
$$;
create function public.crm_record_doctor_visit(p_doctor_id uuid)
returns setof public.doctor_visits
language plpgsql security invoker set search_path = public
as $$
begin
  insert into public.doctor_visits (doctor_id) values (p_doctor_id)
    on conflict (doctor_id, visit_date) do nothing;
  return query select v.* from public.doctor_visits v
    where v.doctor_id = p_doctor_id
      and v.visit_date = (now() at time zone 'America/Argentina/Cordoba')::date;
end;
$$;
revoke all on function public.crm_doctor_last_visits() from public, anon;
revoke all on function public.crm_record_doctor_visit(uuid) from public, anon;
grant execute on function public.crm_doctor_last_visits() to authenticated;
grant execute on function public.crm_record_doctor_visit(uuid) to authenticated;
