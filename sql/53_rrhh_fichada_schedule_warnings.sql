-- RRHH · Avisos de jornada al fichar
-- Permite registrar trabajo extra, pero informa cuando la persona ficha un día sin horario programado.

create or replace function public.hr_mark_by_pin(
  p_pin text,
  p_branch_code text,
  p_terminal_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  e public.hr_employees%rowtype;
  v_now timestamptz := now();
  v_local_date date := (now() at time zone 'America/Argentina/Cordoba')::date;
  v_weekday smallint := extract(dow from (now() at time zone 'America/Argentina/Cordoba'))::smallint;
  v_branch_id uuid;
  v_branch_code text;
  v_last public.hr_time_marks%rowtype;
  v_type text;
  v_seconds_since_last integer;
  v_sched_start time;
  v_sched_end time;
  v_warning text := '';
begin
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN inválido'; end if;

  v_branch_code := lower(trim(coalesce(p_branch_code,'')));
  if v_branch_code in ('alto-palermo','zona-norte','cerro') then v_branch_code := 'cerro-de-las-rosas'; end if;

  select id into v_branch_id from public.branches where code=v_branch_code and active=true limit 1;
  if v_branch_id is null then raise exception 'Sucursal inválida'; end if;

  select * into e
  from public.hr_employees
  where active=true
    and branch_id=v_branch_id
    and pin_hash=extensions.crypt(p_pin,pin_hash)
  limit 1
  for update;

  if e.id is null then raise exception 'PIN incorrecto'; end if;

  select s.start_time,s.end_time into v_sched_start,v_sched_end
  from public.hr_employee_schedules s
  where s.employee_id=e.id and s.weekday=v_weekday and s.active=true
  limit 1;

  if v_sched_start is null or v_sched_end is null then
    v_warning := 'Hoy no tenés una jornada programada. La marcación quedó registrada como jornada extra.';
  end if;

  select * into v_last
  from public.hr_time_marks
  where employee_id=e.id
    and (marked_at at time zone 'America/Argentina/Cordoba')::date=v_local_date
  order by marked_at desc
  limit 1;

  if v_last.id is not null then
    v_seconds_since_last := greatest(0,floor(extract(epoch from (v_now-v_last.marked_at)))::int);
    if v_seconds_since_last < 90 then
      raise exception 'Marcación duplicada: la anterior ya fue registrada hace % segundos',v_seconds_since_last;
    end if;
  end if;

  if v_last.id is null then v_type := 'entrada';
  elsif v_last.mark_type in ('entrada','reingreso') then v_type := 'salida';
  else v_type := 'reingreso';
  end if;

  insert into public.hr_time_marks(employee_id,branch_id,marked_at,mark_type,terminal_code,source)
  values(e.id,v_branch_id,v_now,v_type,nullif(trim(p_terminal_code),''),'terminal');

  return jsonb_build_object(
    'ok',true,'employee_id',e.id,'employee_name',e.full_name,'mark_type',v_type,
    'marked_at',v_now,'branch_code',v_branch_code,
    'next_type',case when v_type in ('entrada','reingreso') then 'salida' else 'reingreso' end,
    'scheduled_today',(v_sched_start is not null and v_sched_end is not null),
    'schedule_start',v_sched_start,'schedule_end',v_sched_end,'warning',v_warning
  );
end;
$$;

revoke all on function public.hr_mark_by_pin(text,text,text) from public,anon,authenticated;
