-- Black OS · RRHH foundation v2
-- Canonicaliza sucursales, reutiliza la tabla public.branches y evita exponer PIN hashes al frontend.

create extension if not exists pgcrypto;

-- ============================================================
-- 1) SUCURSALES CANÓNICAS
-- ============================================================

update public.branches
set code = 'cerro-de-las-rosas',
    name = 'Cerro de las Rosas'
where code = 'alto-palermo';

update public.branches
set code = 'cerro-de-las-rosas',
    name = 'Cerro de las Rosas'
where code in ('zona-norte','cerro')
  and not exists (
    select 1 from public.branches b2 where b2.code = 'cerro-de-las-rosas'
  );

-- Los usuarios que ya tienen rol admin quedan marcados también en app_metadata.
-- Esto mantiene alineados el esquema de roles y el frontend actual.
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data,'{}'::jsonb)
  || jsonb_build_object('black_os_super_admin',true,'black_os_active',true)
where exists (
  select 1
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = u.id
    and r.code = 'admin'
);

-- ============================================================
-- 2) AUTORIZACIÓN BLACK OS / RRHH
-- ============================================================

create or replace function public.black_os_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt()->'app_metadata'->>'black_os_super_admin')::boolean,false)
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.code = 'admin'
    );
$$;

create or replace function public.black_os_can_rrhh(p_permission text default 'view')
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_level text;
  v_items jsonb;
begin
  if public.black_os_is_admin() then
    return true;
  end if;

  v_cfg := auth.jwt()->'app_metadata'->'black_os_permissions'->'rrhh';
  v_level := coalesce(v_cfg->>'level','none');
  v_items := v_cfg->'items';

  if v_level = 'none' then
    return false;
  end if;

  if p_permission is null or p_permission = 'view' then
    return true;
  end if;

  if v_level = 'full' or v_items = '"*"'::jsonb then
    return true;
  end if;

  return jsonb_typeof(v_items) = 'array' and v_items ? p_permission;
end;
$$;

revoke all on function public.black_os_is_admin() from public;
revoke all on function public.black_os_can_rrhh(text) from public;
grant execute on function public.black_os_is_admin() to authenticated;
grant execute on function public.black_os_can_rrhh(text) to authenticated;

-- ============================================================
-- 3) MODELO RRHH
-- ============================================================

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null references auth.users(id) on delete set null,
  full_name text not null,
  email text null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  tolerance_minutes integer not null default 10 check (tolerance_minutes between 0 and 120),
  monthly_reference_salary numeric(14,2) not null default 0 check (monthly_reference_salary >= 0),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hr_employees_auth_user_unique
  on public.hr_employees(auth_user_id)
  where auth_user_id is not null;

create index if not exists hr_employees_branch_idx
  on public.hr_employees(branch_id);

create table if not exists public.hr_employee_schedules (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,weekday),
  check (end_time > start_time)
);

create index if not exists hr_employee_schedules_employee_idx
  on public.hr_employee_schedules(employee_id);

create table if not exists public.hr_terminals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_time_marks (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.hr_employees(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  marked_at timestamptz not null default now(),
  mark_type text not null check (mark_type in ('entrada','salida','reingreso')),
  terminal_code text null,
  source text not null default 'terminal',
  note text null,
  is_manual boolean not null default false,
  corrected_at timestamptz null,
  corrected_by uuid null references auth.users(id) on delete set null,
  correction_reason text null,
  created_at timestamptz not null default now()
);

create index if not exists hr_time_marks_employee_marked_idx
  on public.hr_time_marks(employee_id, marked_at desc);
create index if not exists hr_time_marks_branch_marked_idx
  on public.hr_time_marks(branch_id, marked_at desc);

create table if not exists public.hr_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.hr_employees enable row level security;
alter table public.hr_employee_schedules enable row level security;
alter table public.hr_terminals enable row level security;
alter table public.hr_time_marks enable row level security;
alter table public.hr_audit_log enable row level security;

-- No se exponen tablas RRHH directamente al navegador.
revoke all on public.hr_employees from anon, authenticated;
revoke all on public.hr_employee_schedules from anon, authenticated;
revoke all on public.hr_terminals from anon, authenticated;
revoke all on public.hr_time_marks from anon, authenticated;
revoke all on public.hr_audit_log from anon, authenticated;

-- ============================================================
-- 4) RPC ADMINISTRATIVAS SEGURAS
-- ============================================================

create or replace function public.hr_upsert_employee(
  p_employee_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_branch_id uuid;
  v_branch_code text;
  v_pin text := nullif(trim(p_payload->>'pin_plain'),'');
  v_name text := nullif(trim(p_payload->>'full_name'),'');
  v_week_start time := coalesce(nullif(p_payload->>'scheduled_start','')::time,'09:00'::time);
  v_week_end time := coalesce(nullif(p_payload->>'scheduled_end','')::time,'19:00'::time);
  v_sat_start time := nullif(p_payload->>'sat_start','')::time;
  v_sat_end time := nullif(p_payload->>'sat_end','')::time;
  v_day smallint;
begin
  if not public.black_os_can_rrhh('manage_employees') then
    raise exception 'No autorizado';
  end if;

  if v_name is null then
    raise exception 'Ingresá el nombre del integrante';
  end if;

  v_branch_code := coalesce(nullif(p_payload->>'branch_code',''),'general-paz');
  if v_branch_code in ('alto-palermo','zona-norte','cerro') then
    v_branch_code := 'cerro-de-las-rosas';
  end if;

  select id into v_branch_id
  from public.branches
  where code = v_branch_code and active = true
  limit 1;

  if v_branch_id is null then
    raise exception 'Sucursal inválida';
  end if;

  if v_week_end <= v_week_start then
    raise exception 'El horario de salida debe ser posterior al de entrada';
  end if;

  if (v_sat_start is null) <> (v_sat_end is null) then
    raise exception 'Completá ambos horarios del sábado o dejalos vacíos';
  end if;

  if v_sat_start is not null and v_sat_end <= v_sat_start then
    raise exception 'El horario de salida del sábado debe ser posterior al de entrada';
  end if;

  if v_pin is not null and v_pin !~ '^[0-9]{4,6}$' then
    raise exception 'El PIN debe tener entre 4 y 6 dígitos';
  end if;

  if p_employee_id is null and v_pin is null then
    raise exception 'PIN requerido';
  end if;

  if v_pin is not null and exists (
    select 1
    from public.hr_employees e
    where (p_employee_id is null or e.id <> p_employee_id)
      and e.pin_hash = crypt(v_pin,e.pin_hash)
  ) then
    raise exception 'Ese PIN ya está asignado a otro integrante';
  end if;

  if p_employee_id is null then
    insert into public.hr_employees(
      full_name,email,branch_id,tolerance_minutes,monthly_reference_salary,pin_hash,active
    )
    values(
      v_name,
      nullif(trim(p_payload->>'email'),''),
      v_branch_id,
      greatest(0,least(120,coalesce((p_payload->>'tolerance_minutes')::int,10))),
      greatest(0,coalesce((p_payload->>'monthly_reference_salary')::numeric,0)),
      crypt(v_pin,gen_salt('bf')),
      coalesce((p_payload->>'active')::boolean,true)
    )
    returning id into v_id;
  else
    update public.hr_employees
    set full_name = v_name,
        email = coalesce(nullif(trim(p_payload->>'email'),''),email),
        branch_id = v_branch_id,
        tolerance_minutes = greatest(0,least(120,coalesce((p_payload->>'tolerance_minutes')::int,tolerance_minutes))),
        monthly_reference_salary = greatest(0,coalesce((p_payload->>'monthly_reference_salary')::numeric,monthly_reference_salary)),
        pin_hash = case when v_pin is null then pin_hash else crypt(v_pin,gen_salt('bf')) end,
        active = coalesce((p_payload->>'active')::boolean,active),
        updated_at = now()
    where id = p_employee_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Integrante no encontrado';
    end if;
  end if;

  for v_day in 1..5 loop
    insert into public.hr_employee_schedules(employee_id,weekday,start_time,end_time,active)
    values(v_id,v_day,v_week_start,v_week_end,true)
    on conflict(employee_id,weekday)
    do update set start_time=excluded.start_time,end_time=excluded.end_time,active=true,updated_at=now();
  end loop;

  if v_sat_start is not null and v_sat_end is not null then
    insert into public.hr_employee_schedules(employee_id,weekday,start_time,end_time,active)
    values(v_id,6,v_sat_start,v_sat_end,true)
    on conflict(employee_id,weekday)
    do update set start_time=excluded.start_time,end_time=excluded.end_time,active=true,updated_at=now();
  else
    delete from public.hr_employee_schedules where employee_id=v_id and weekday=6;
  end if;

  insert into public.hr_audit_log(actor_user_id,action,entity_type,entity_id,detail)
  values(
    auth.uid(),
    case when p_employee_id is null then 'employee_created' else 'employee_updated' end,
    'employee',
    v_id::text,
    jsonb_build_object('branch_code',v_branch_code,'full_name',v_name)
  );

  return v_id;
end;
$$;

create or replace function public.hr_list_employees()
returns table(
  id uuid,
  auth_user_id uuid,
  full_name text,
  email text,
  branch_id uuid,
  branch_code text,
  branch_name text,
  tolerance_minutes integer,
  monthly_reference_salary numeric,
  active boolean,
  scheduled_start time,
  scheduled_end time,
  sat_start time,
  sat_end time
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.black_os_can_rrhh('view') then
    raise exception 'No autorizado';
  end if;

  return query
  select
    e.id,e.auth_user_id,e.full_name,e.email,e.branch_id,b.code,b.name,
    e.tolerance_minutes,e.monthly_reference_salary,e.active,
    (select s.start_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=1 and s.active limit 1),
    (select s.end_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=1 and s.active limit 1),
    (select s.start_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=6 and s.active limit 1),
    (select s.end_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=6 and s.active limit 1)
  from public.hr_employees e
  join public.branches b on b.id=e.branch_id
  order by e.active desc,e.full_name;
end;
$$;

create or replace function public.hr_list_marks(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  id bigint,
  employee_id uuid,
  employee_name text,
  marked_at timestamptz,
  mark_type text,
  branch_code text,
  branch_name text,
  terminal_code text,
  source text,
  note text,
  is_manual boolean,
  late_minutes integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.black_os_can_rrhh('attendance') and not public.black_os_can_rrhh('view') then
    raise exception 'No autorizado';
  end if;

  return query
  with ordered as (
    select
      m.*,
      e.full_name,
      e.tolerance_minutes,
      b.code as bcode,
      b.name as bname,
      (m.marked_at at time zone 'America/Argentina/Cordoba')::date as local_date,
      (m.marked_at at time zone 'America/Argentina/Cordoba') as local_ts,
      row_number() over (
        partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date
        order by m.marked_at
      ) as rn
    from public.hr_time_marks m
    join public.hr_employees e on e.id=m.employee_id
    join public.branches b on b.id=m.branch_id
    where m.marked_at >= p_from
      and m.marked_at <= p_to
  )
  select
    o.id,o.employee_id,o.full_name,o.marked_at,o.mark_type,o.bcode,o.bname,
    o.terminal_code,o.source,o.note,o.is_manual,
    case
      when o.rn <> 1 then 0
      when s.start_time is null then 0
      else greatest(
        0,
        floor(extract(epoch from (o.local_ts - (o.local_date + s.start_time)))/60)::int - o.tolerance_minutes
      )
    end as late_minutes
  from ordered o
  left join public.hr_employee_schedules s
    on s.employee_id=o.employee_id
   and s.weekday=extract(dow from o.local_date)::smallint
   and s.active
  order by o.marked_at;
end;
$$;

create or replace function public.hr_monthly_summary(p_month date)
returns table(
  employee_id uuid,
  full_name text,
  expected_month_minutes integer,
  expected_to_date_minutes integer,
  worked_minutes integer,
  late_minutes integer,
  late_days integer,
  scheduled_days_with_marks integer,
  incomplete_days integer,
  punctuality_pct numeric,
  hourly_rate numeric,
  late_value_reference numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.black_os_can_rrhh('reports') and not public.black_os_can_rrhh('view') then
    raise exception 'No autorizado';
  end if;

  return query
  with params as (
    select
      date_trunc('month',p_month)::date as month_start,
      (date_trunc('month',p_month)+interval '1 month - 1 day')::date as month_end,
      (now() at time zone 'America/Argentina/Cordoba')::date as today
  ),
  calendar as (
    select generate_series(p.month_start,p.month_end,interval '1 day')::date as d,p.*
    from params p
  ),
  expected as (
    select
      e.id as employee_id,
      coalesce(sum(extract(epoch from (s.end_time-s.start_time))/60),0)::int as month_minutes,
      coalesce(sum(
        case
          when c.d <= case
            when c.month_start > c.today then c.month_start-1
            when c.month_end < c.today then c.month_end
            else c.today
          end
          then extract(epoch from (s.end_time-s.start_time))/60
          else 0
        end
      ),0)::int as to_date_minutes
    from public.hr_employees e
    cross join calendar c
    left join public.hr_employee_schedules s
      on s.employee_id=e.id
     and s.weekday=extract(dow from c.d)::smallint
     and s.active
    where e.active
    group by e.id
  ),
  month_marks as (
    select
      m.*,
      (m.marked_at at time zone 'America/Argentina/Cordoba')::date as local_date,
      (m.marked_at at time zone 'America/Argentina/Cordoba') as local_ts,
      lead(m.marked_at) over (
        partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date
        order by m.marked_at
      ) as next_marked_at,
      lead(m.mark_type) over (
        partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date
        order by m.marked_at
      ) as next_type,
      row_number() over (
        partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date
        order by m.marked_at
      ) as rn_first,
      row_number() over (
        partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date
        order by m.marked_at desc
      ) as rn_last
    from public.hr_time_marks m, params p
    where (m.marked_at at time zone 'America/Argentina/Cordoba')::date between p.month_start and p.month_end
  ),
  worked as (
    select employee_id,
      coalesce(sum(
        case
          when mark_type in ('entrada','reingreso')
           and next_type='salida'
           and (next_marked_at at time zone 'America/Argentina/Cordoba')::date=local_date
          then extract(epoch from (next_marked_at-marked_at))/60
          else 0
        end
      ),0)::int as worked_minutes
    from month_marks
    group by employee_id
  ),
  first_marks as (
    select
      mm.employee_id,
      mm.local_date,
      case
        when s.start_time is null then 0
        else greatest(
          0,
          floor(extract(epoch from (mm.local_ts-(mm.local_date+s.start_time)))/60)::int-e.tolerance_minutes
        )
      end as late_minutes,
      (s.start_time is not null) as scheduled
    from month_marks mm
    join public.hr_employees e on e.id=mm.employee_id
    left join public.hr_employee_schedules s
      on s.employee_id=mm.employee_id
     and s.weekday=extract(dow from mm.local_date)::smallint
     and s.active
    where mm.rn_first=1
  ),
  punctuality as (
    select
      employee_id,
      coalesce(sum(late_minutes),0)::int as late_minutes,
      count(*) filter(where late_minutes>0)::int as late_days,
      count(*) filter(where scheduled)::int as scheduled_days_with_marks
    from first_marks
    group by employee_id
  ),
  incomplete as (
    select employee_id,
      count(*) filter(where mark_type in ('entrada','reingreso'))::int as incomplete_days
    from month_marks
    where rn_last=1
    group by employee_id
  )
  select
    e.id,
    e.full_name,
    coalesce(ex.month_minutes,0),
    coalesce(ex.to_date_minutes,0),
    coalesce(w.worked_minutes,0),
    coalesce(pu.late_minutes,0),
    coalesce(pu.late_days,0),
    coalesce(pu.scheduled_days_with_marks,0),
    coalesce(i.incomplete_days,0),
    case
      when coalesce(pu.scheduled_days_with_marks,0)=0 then null
      else round(
        ((pu.scheduled_days_with_marks-pu.late_days)::numeric/pu.scheduled_days_with_marks::numeric)*100,
        1
      )
    end as punctuality_pct,
    case
      when coalesce(ex.month_minutes,0)=0 then 0
      else round(e.monthly_reference_salary/(ex.month_minutes::numeric/60),2)
    end as hourly_rate,
    case
      when coalesce(ex.month_minutes,0)=0 then 0
      else round(
        (coalesce(pu.late_minutes,0)::numeric/60)
        * (e.monthly_reference_salary/(ex.month_minutes::numeric/60)),
        2
      )
    end as late_value_reference
  from public.hr_employees e
  left join expected ex on ex.employee_id=e.id
  left join worked w on w.employee_id=e.id
  left join punctuality pu on pu.employee_id=e.id
  left join incomplete i on i.employee_id=e.id
  where e.active
  order by e.full_name;
end;
$$;

revoke all on function public.hr_upsert_employee(uuid,jsonb) from public;
revoke all on function public.hr_list_employees() from public;
revoke all on function public.hr_list_marks(timestamptz,timestamptz) from public;
revoke all on function public.hr_monthly_summary(date) from public;

grant execute on function public.hr_upsert_employee(uuid,jsonb) to authenticated;
grant execute on function public.hr_list_employees() to authenticated;
grant execute on function public.hr_list_marks(timestamptz,timestamptz) to authenticated;
grant execute on function public.hr_monthly_summary(date) to authenticated;

-- ============================================================
-- 5) RPC DE MARCACIÓN
-- ============================================================
-- Esta función queda reservada a service_role. El fichador público deberá
-- invocarla detrás de una Edge Function con control de terminal y rate limiting.

create or replace function public.hr_mark_by_pin(
  p_pin text,
  p_branch_code text,
  p_terminal_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.hr_employees%rowtype;
  v_now timestamptz := now();
  v_local_date date := (now() at time zone 'America/Argentina/Cordoba')::date;
  v_branch_id uuid;
  v_branch_code text;
  v_last public.hr_time_marks%rowtype;
  v_type text;
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN inválido';
  end if;

  v_branch_code := lower(trim(coalesce(p_branch_code,'')));
  if v_branch_code in ('alto-palermo','zona-norte','cerro') then
    v_branch_code := 'cerro-de-las-rosas';
  end if;

  select id into v_branch_id
  from public.branches
  where code=v_branch_code and active=true
  limit 1;

  if v_branch_id is null then
    raise exception 'Sucursal inválida';
  end if;

  select * into e
  from public.hr_employees
  where active=true
    and pin_hash=crypt(p_pin,pin_hash)
  limit 1;

  if e.id is null then
    raise exception 'PIN incorrecto';
  end if;

  select * into v_last
  from public.hr_time_marks
  where employee_id=e.id
    and (marked_at at time zone 'America/Argentina/Cordoba')::date=v_local_date
  order by marked_at desc
  limit 1;

  if v_last.id is not null and extract(epoch from (v_now-v_last.marked_at)) < 15 then
    raise exception 'Esperá unos segundos antes de volver a marcar';
  end if;

  if v_last.id is null then
    v_type := 'entrada';
  elsif v_last.mark_type in ('entrada','reingreso') then
    v_type := 'salida';
  else
    v_type := 'reingreso';
  end if;

  insert into public.hr_time_marks(
    employee_id,branch_id,marked_at,mark_type,terminal_code,source
  )
  values(
    e.id,v_branch_id,v_now,v_type,nullif(trim(p_terminal_code),''),'terminal'
  );

  return jsonb_build_object(
    'ok',true,
    'employee_id',e.id,
    'employee_name',e.full_name,
    'mark_type',v_type,
    'marked_at',v_now,
    'branch_code',v_branch_code,
    'next_type',case when v_type in ('entrada','reingreso') then 'salida' else 'reingreso' end
  );
end;
$$;

revoke all on function public.hr_mark_by_pin(text,text,text) from public;
grant execute on function public.hr_mark_by_pin(text,text,text) to service_role;
