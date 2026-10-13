-- RRHH · Días laborales flexibles + eliminación administrativa de fichadas
-- Permite definir qué días trabaja cada integrante y horarios por día.
-- La eliminación de una fichada queda registrada previamente en hr_audit_log.

create or replace function public.hr_upsert_employee(p_employee_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,extensions
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
  v_schedule jsonb;
  v_start time;
  v_end time;
begin
  if not public.black_os_can_rrhh('manage_employees') then raise exception 'No autorizado'; end if;
  if v_name is null then raise exception 'Ingresá el nombre del integrante'; end if;

  v_branch_code := coalesce(nullif(p_payload->>'branch_code',''),'general-paz');
  if v_branch_code in ('alto-palermo','zona-norte','cerro') then v_branch_code := 'cerro-de-las-rosas'; end if;
  if not public.black_os_branch_allowed(v_branch_code) then raise exception 'No tenés acceso a esa sucursal'; end if;

  select id into v_branch_id from public.branches where code=v_branch_code and active=true limit 1;
  if v_branch_id is null then raise exception 'Sucursal inválida'; end if;

  if v_pin is not null and v_pin !~ '^[0-9]{4,6}$' then raise exception 'El PIN debe tener entre 4 y 6 dígitos'; end if;
  if p_employee_id is null and v_pin is null then raise exception 'PIN requerido'; end if;

  if v_pin is not null and exists(
    select 1 from public.hr_employees e
    where (p_employee_id is null or e.id<>p_employee_id)
      and e.pin_hash=extensions.crypt(v_pin,e.pin_hash)
  ) then raise exception 'Ese PIN ya está asignado a otro integrante'; end if;

  if p_employee_id is null then
    insert into public.hr_employees(full_name,email,branch_id,tolerance_minutes,monthly_reference_salary,pin_hash,active)
    values(
      v_name,nullif(trim(p_payload->>'email'),''),v_branch_id,
      greatest(0,least(120,coalesce((p_payload->>'tolerance_minutes')::int,10))),
      greatest(0,coalesce((p_payload->>'monthly_reference_salary')::numeric,0)),
      extensions.crypt(v_pin,extensions.gen_salt('bf')),
      coalesce((p_payload->>'active')::boolean,true)
    ) returning id into v_id;
  else
    update public.hr_employees
    set full_name=v_name,
        email=case when p_payload ? 'email' then nullif(trim(p_payload->>'email'),'') else email end,
        branch_id=v_branch_id,
        tolerance_minutes=greatest(0,least(120,coalesce((p_payload->>'tolerance_minutes')::int,tolerance_minutes))),
        monthly_reference_salary=case
          when public.black_os_can_rrhh('salary_reference') then greatest(0,coalesce((p_payload->>'monthly_reference_salary')::numeric,monthly_reference_salary))
          else monthly_reference_salary
        end,
        pin_hash=case when v_pin is null then pin_hash else extensions.crypt(v_pin,extensions.gen_salt('bf')) end,
        active=coalesce((p_payload->>'active')::boolean,active),
        updated_at=now()
    where id=p_employee_id
      and public.black_os_branch_allowed((select b.code from public.branches b where b.id=hr_employees.branch_id))
    returning id into v_id;
    if v_id is null then raise exception 'Integrante no encontrado o fuera de tu alcance'; end if;
  end if;

  if p_payload ? 'schedules' then
    delete from public.hr_employee_schedules where employee_id=v_id;

    for v_schedule in
      select value from jsonb_array_elements(coalesce(p_payload->'schedules','[]'::jsonb))
    loop
      v_day := nullif(v_schedule->>'weekday','')::smallint;
      v_start := nullif(v_schedule->>'start_time','')::time;
      v_end := nullif(v_schedule->>'end_time','')::time;

      if v_day is null or v_day<0 or v_day>6 then raise exception 'Día de trabajo inválido'; end if;
      if v_start is null or v_end is null then raise exception 'Completá entrada y salida para cada día seleccionado'; end if;
      if v_end<=v_start then raise exception 'La salida debe ser posterior a la entrada'; end if;

      insert into public.hr_employee_schedules(employee_id,weekday,start_time,end_time,active)
      values(v_id,v_day,v_start,v_end,true)
      on conflict(employee_id,weekday) do update
        set start_time=excluded.start_time,end_time=excluded.end_time,active=true,updated_at=now();
    end loop;
  else
    if v_week_end<=v_week_start then raise exception 'El horario de salida debe ser posterior al de entrada'; end if;
    if (v_sat_start is null)<>(v_sat_end is null) then raise exception 'Completá ambos horarios del sábado o dejalos vacíos'; end if;
    if v_sat_start is not null and v_sat_end<=v_sat_start then raise exception 'El horario de salida del sábado debe ser posterior al de entrada'; end if;

    for v_day in 1..5 loop
      insert into public.hr_employee_schedules(employee_id,weekday,start_time,end_time,active)
      values(v_id,v_day,v_week_start,v_week_end,true)
      on conflict(employee_id,weekday) do update
        set start_time=excluded.start_time,end_time=excluded.end_time,active=true,updated_at=now();
    end loop;

    if v_sat_start is not null and v_sat_end is not null then
      insert into public.hr_employee_schedules(employee_id,weekday,start_time,end_time,active)
      values(v_id,6,v_sat_start,v_sat_end,true)
      on conflict(employee_id,weekday) do update
        set start_time=excluded.start_time,end_time=excluded.end_time,active=true,updated_at=now();
    else
      delete from public.hr_employee_schedules where employee_id=v_id and weekday=6;
    end if;
  end if;

  insert into public.hr_audit_log(actor_user_id,action,entity_type,entity_id,detail)
  values(auth.uid(),case when p_employee_id is null then 'employee_created' else 'employee_updated' end,
         'employee',v_id::text,jsonb_build_object('branch_code',v_branch_code,'full_name',v_name,'schedules',coalesce(p_payload->'schedules','null'::jsonb)));

  return v_id;
end;
$$;

create or replace function public.hr_list_employee_schedules()
returns table(employee_id uuid,weekday smallint,start_time time,end_time time)
language sql
stable
security definer
set search_path=public
as $$
  select s.employee_id,s.weekday,s.start_time,s.end_time
  from public.hr_employee_schedules s
  join public.hr_employees e on e.id=s.employee_id
  join public.branches b on b.id=e.branch_id
  where s.active=true
    and public.black_os_has_module('rrhh')
    and public.black_os_branch_allowed(b.code)
  order by e.full_name,s.weekday;
$$;

revoke all on function public.hr_list_employee_schedules() from public,anon;
grant execute on function public.hr_list_employee_schedules() to authenticated;

create or replace function public.hr_delete_time_mark(p_mark_id bigint,p_reason text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_mark public.hr_time_marks%rowtype;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if not public.black_os_is_admin() then raise exception 'Solo un administrador puede eliminar fichadas'; end if;
  if v_reason is null or length(v_reason)<4 then raise exception 'Indicá el motivo de la eliminación'; end if;

  select m.* into v_mark
  from public.hr_time_marks m
  join public.branches b on b.id=m.branch_id
  where m.id=p_mark_id and public.black_os_branch_allowed(b.code)
  limit 1
  for update;

  if v_mark.id is null then raise exception 'Marcación no encontrada o fuera de tu alcance'; end if;

  insert into public.hr_audit_log(actor_user_id,action,entity_type,entity_id,detail)
  values(auth.uid(),'time_mark_deleted','time_mark',v_mark.id::text,
    jsonb_build_object('employee_id',v_mark.employee_id,'branch_id',v_mark.branch_id,'marked_at',v_mark.marked_at,
      'mark_type',v_mark.mark_type,'terminal_code',v_mark.terminal_code,'source',v_mark.source,'note',v_mark.note,
      'was_manual',v_mark.is_manual,'reason',v_reason));

  delete from public.hr_time_marks where id=v_mark.id;
  return true;
end;
$$;

revoke all on function public.hr_delete_time_mark(bigint,text) from public,anon;
grant execute on function public.hr_delete_time_mark(bigint,text) to authenticated;
