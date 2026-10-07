-- RRHH · Reporte individual diario y precisión mensual
-- Permite analizar cumplimiento horario por persona y rango de fechas.
-- Importante: mide asistencia/puntualidad, no productividad general.

create or replace function public.hr_employee_daily_report(
  p_employee_id uuid,
  p_from date,
  p_to date
)
returns table(
  work_date date,
  weekday smallint,
  scheduled boolean,
  scheduled_start time,
  scheduled_end time,
  expected_minutes integer,
  first_entry timestamptz,
  last_mark timestamptz,
  last_mark_type text,
  mark_count integer,
  worked_minutes integer,
  late_minutes integer,
  early_leave_minutes integer,
  overtime_minutes integer,
  balance_minutes integer,
  incomplete boolean,
  status text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.black_os_can_rrhh('reports') then raise exception 'No autorizado'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'Período inválido'; end if;
  if p_to-p_from>366 then raise exception 'El rango máximo es de 366 días'; end if;

  if not exists(
    select 1
    from public.hr_employees e
    join public.branches b on b.id=e.branch_id
    where e.id=p_employee_id and public.black_os_branch_allowed(b.code)
  ) then raise exception 'Integrante no encontrado o fuera de tu alcance'; end if;

  return query
  with employee as(
    select e.tolerance_minutes,
      (e.created_at at time zone 'America/Argentina/Cordoba')::date employee_start
    from public.hr_employees e where e.id=p_employee_id
  ),
  calendar as(select generate_series(p_from,p_to,interval '1 day')::date d),
  schedule as(
    select c.d,extract(dow from c.d)::smallint dow,
      case when c.d>=e.employee_start then s.start_time else null end start_time,
      case when c.d>=e.employee_start then s.end_time else null end end_time,
      (c.d>=e.employee_start and s.start_time is not null and s.end_time is not null and s.active) is_scheduled,
      case when c.d>=e.employee_start and s.start_time is not null and s.end_time is not null and s.active
        then greatest(0,floor(extract(epoch from(s.end_time-s.start_time))/60)::int) else 0 end expected_minutes,
      e.tolerance_minutes,e.employee_start
    from calendar c cross join employee e
    left join public.hr_employee_schedules s
      on s.employee_id=p_employee_id
     and s.weekday=extract(dow from c.d)::smallint and s.active
  ),
  marks as(
    select m.*,
      (m.marked_at at time zone 'America/Argentina/Cordoba')::date local_date,
      (m.marked_at at time zone 'America/Argentina/Cordoba') local_ts,
      lead(m.marked_at) over(partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date order by m.marked_at) next_marked_at,
      lead(m.mark_type) over(partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date order by m.marked_at) next_type,
      row_number() over(partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date order by m.marked_at) rn_first,
      row_number() over(partition by m.employee_id,(m.marked_at at time zone 'America/Argentina/Cordoba')::date order by m.marked_at desc) rn_last
    from public.hr_time_marks m
    where m.employee_id=p_employee_id
      and (m.marked_at at time zone 'America/Argentina/Cordoba')::date between p_from and p_to
  ),
  dayagg as(
    select local_date,
      min(marked_at) filter(where rn_first=1) first_entry,
      max(marked_at) filter(where rn_last=1) last_mark,
      max(mark_type) filter(where rn_last=1) last_mark_type,
      count(*)::int mark_count,
      coalesce(sum(case when mark_type in('entrada','reingreso') and next_type='salida'
        and(next_marked_at at time zone 'America/Argentina/Cordoba')::date=local_date
        then extract(epoch from(next_marked_at-marked_at))/60 else 0 end),0)::int worked_minutes
    from marks group by local_date
  )
  select s.d,s.dow,s.is_scheduled,s.start_time,s.end_time,s.expected_minutes,
    d.first_entry,d.last_mark,d.last_mark_type,coalesce(d.mark_count,0),coalesce(d.worked_minutes,0),
    case when not s.is_scheduled or d.first_entry is null then 0
      else greatest(0,floor(extract(epoch from((d.first_entry at time zone 'America/Argentina/Cordoba')-(s.d+s.start_time)))/60)::int-coalesce(s.tolerance_minutes,0)) end,
    case when not s.is_scheduled or d.last_mark is null or d.last_mark_type<>'salida' then 0
      else greatest(0,floor(extract(epoch from((s.d+s.end_time)-(d.last_mark at time zone 'America/Argentina/Cordoba')))/60)::int) end,
    greatest(0,coalesce(d.worked_minutes,0)-s.expected_minutes),
    coalesce(d.worked_minutes,0)-s.expected_minutes,
    (coalesce(d.mark_count,0)>0 and coalesce(d.last_mark_type,'') in('entrada','reingreso')),
    case
      when s.d<s.employee_start then 'off'
      when s.d>(now() at time zone 'America/Argentina/Cordoba')::date then 'future'
      when not s.is_scheduled and coalesce(d.mark_count,0)=0 then 'off'
      when not s.is_scheduled and coalesce(d.mark_count,0)>0 then 'extra'
      when s.is_scheduled and coalesce(d.mark_count,0)=0 then 'missing'
      when coalesce(d.last_mark_type,'') in('entrada','reingreso') then 'incomplete'
      when coalesce(d.worked_minutes,0)>=s.expected_minutes
       and greatest(0,floor(extract(epoch from((d.first_entry at time zone 'America/Argentina/Cordoba')-(s.d+s.start_time)))/60)::int-coalesce(s.tolerance_minutes,0))=0
        then 'complete'
      else 'partial'
    end
  from schedule s left join dayagg d on d.local_date=s.d
  order by s.d;
end;
$$;

revoke all on function public.hr_employee_daily_report(uuid,date,date) from public,anon;
grant execute on function public.hr_employee_daily_report(uuid,date,date) to authenticated;
