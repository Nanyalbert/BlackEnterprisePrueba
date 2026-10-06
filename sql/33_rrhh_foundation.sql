-- Black OS · RRHH foundation
create extension if not exists pgcrypto;

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null references auth.users(id) on delete set null,
  full_name text not null,
  email text null,
  branch_code text not null default 'general-paz' check (branch_code in ('general-paz','cerro')),
  scheduled_start time not null default '09:00',
  scheduled_end time not null default '19:00',
  tolerance_minutes integer not null default 10 check (tolerance_minutes between 0 and 120),
  monthly_reference_salary numeric(14,2) not null default 0,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_time_marks (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.hr_employees(id) on delete restrict,
  marked_at timestamptz not null default now(),
  branch_code text not null check (branch_code in ('general-paz','cerro')),
  terminal_code text null,
  source text not null default 'terminal',
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists hr_time_marks_employee_marked_idx on public.hr_time_marks(employee_id, marked_at desc);

alter table public.hr_employees enable row level security;
alter table public.hr_time_marks enable row level security;

create or replace function public.is_black_os_owner()
returns boolean language sql stable security definer set search_path=public
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'black_os_super_admin')::boolean,false)
      or lower(coalesce(auth.jwt()->>'email',''))='leandro@blackoptica.ar';
$$;

drop policy if exists "rrhh owner employees" on public.hr_employees;
create policy "rrhh owner employees" on public.hr_employees for all to authenticated
using (public.is_black_os_owner()) with check (public.is_black_os_owner());

drop policy if exists "rrhh owner marks" on public.hr_time_marks;
create policy "rrhh owner marks" on public.hr_time_marks for all to authenticated
using (public.is_black_os_owner()) with check (public.is_black_os_owner());

create or replace function public.hr_upsert_employee(p_employee_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_pin text := nullif(trim(p_payload->>'pin_plain'),'');
begin
  if not public.is_black_os_owner() then raise exception 'No autorizado'; end if;
  if v_pin is not null and v_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN inválido'; end if;

  if p_employee_id is null then
    if v_pin is null then raise exception 'PIN requerido'; end if;
    insert into public.hr_employees(full_name,branch_code,scheduled_start,scheduled_end,tolerance_minutes,monthly_reference_salary,pin_hash,active)
    values(
      trim(p_payload->>'full_name'),
      coalesce(p_payload->>'branch_code','general-paz'),
      coalesce((p_payload->>'scheduled_start')::time,'09:00'::time),
      coalesce((p_payload->>'scheduled_end')::time,'19:00'::time),
      coalesce((p_payload->>'tolerance_minutes')::int,10),
      coalesce((p_payload->>'monthly_reference_salary')::numeric,0),
      crypt(v_pin,gen_salt('bf')),
      coalesce((p_payload->>'active')::boolean,true)
    ) returning id into v_id;
  else
    update public.hr_employees set
      full_name=coalesce(nullif(trim(p_payload->>'full_name'),''),full_name),
      branch_code=coalesce(p_payload->>'branch_code',branch_code),
      scheduled_start=coalesce((p_payload->>'scheduled_start')::time,scheduled_start),
      scheduled_end=coalesce((p_payload->>'scheduled_end')::time,scheduled_end),
      tolerance_minutes=coalesce((p_payload->>'tolerance_minutes')::int,tolerance_minutes),
      monthly_reference_salary=coalesce((p_payload->>'monthly_reference_salary')::numeric,monthly_reference_salary),
      pin_hash=case when v_pin is null then pin_hash else crypt(v_pin,gen_salt('bf')) end,
      active=coalesce((p_payload->>'active')::boolean,active),
      updated_at=now()
    where id=p_employee_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.hr_upsert_employee(uuid,jsonb) from public;
grant execute on function public.hr_upsert_employee(uuid,jsonb) to authenticated;

-- Terminal RPC: no select de empleados ni exposición de hashes.
create or replace function public.hr_mark_by_pin(p_pin text,p_branch_code text,p_terminal_code text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.hr_employees%rowtype;
  v_now timestamptz:=now();
  v_count int;
  v_type text;
begin
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN inválido'; end if;
  select * into e from public.hr_employees
   where active=true and pin_hash=crypt(p_pin,pin_hash)
   limit 1;
  if e.id is null then raise exception 'PIN incorrecto'; end if;

  select count(*) into v_count from public.hr_time_marks
   where employee_id=e.id and marked_at >= date_trunc('day',v_now) and marked_at < date_trunc('day',v_now)+interval '1 day';

  v_type:=case when mod(v_count,2)=0 then case when v_count=0 then 'entrada' else 'reingreso' end else 'salida' end;

  insert into public.hr_time_marks(employee_id,marked_at,branch_code,terminal_code,source)
  values(e.id,v_now,p_branch_code,p_terminal_code,'terminal');

  return jsonb_build_object('ok',true,'employee_id',e.id,'employee_name',e.full_name,'mark_type',v_type,'marked_at',v_now,'next_type',case when v_type in ('entrada','reingreso') then 'salida' else 'reingreso' end);
end;
$$;

revoke all on function public.hr_mark_by_pin(text,text,text) from public;
grant execute on function public.hr_mark_by_pin(text,text,text) to anon,authenticated;
