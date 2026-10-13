-- RRHH · Correcciones manuales auditables de fichadas

create or replace function public.hr_save_time_mark(
  p_mark_id bigint,
  p_employee_id uuid,
  p_marked_at timestamptz,
  p_mark_type text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id bigint;
  v_branch_id uuid;
  v_branch_code text;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_type text:=lower(trim(coalesce(p_mark_type,'')));
  v_existing public.hr_time_marks%rowtype;
begin
  if not public.black_os_can_rrhh('settings') then raise exception 'No autorizado para corregir fichadas'; end if;
  if p_employee_id is null then raise exception 'Seleccioná un integrante'; end if;
  if p_marked_at is null then raise exception 'Indicá fecha y hora'; end if;
  if p_marked_at > now()+interval '5 minutes' then raise exception 'La marcación no puede quedar en el futuro'; end if;
  if v_type not in ('entrada','salida','reingreso') then raise exception 'Tipo de marcación inválido'; end if;
  if v_reason is null or length(v_reason)<4 then raise exception 'Indicá el motivo del ajuste'; end if;

  select e.branch_id,b.code into v_branch_id,v_branch_code
  from public.hr_employees e
  join public.branches b on b.id=e.branch_id
  where e.id=p_employee_id
  limit 1;

  if v_branch_id is null or not public.black_os_branch_allowed(v_branch_code) then
    raise exception 'Integrante fuera de tu alcance';
  end if;

  if p_mark_id is null then
    insert into public.hr_time_marks(
      employee_id,branch_id,marked_at,mark_type,terminal_code,source,note,is_manual,
      corrected_at,corrected_by,correction_reason
    )
    values(p_employee_id,v_branch_id,p_marked_at,v_type,null,'manual',v_reason,true,now(),auth.uid(),v_reason)
    returning id into v_id;

    insert into public.hr_audit_log(actor_user_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'time_mark_created_manual','time_mark',v_id::text,
      jsonb_build_object('employee_id',p_employee_id,'marked_at',p_marked_at,'mark_type',v_type,'reason',v_reason));
  else
    select m.* into v_existing
    from public.hr_time_marks m
    join public.branches b on b.id=m.branch_id
    where m.id=p_mark_id and public.black_os_branch_allowed(b.code)
    limit 1
    for update;

    if v_existing.id is null then raise exception 'Marcación no encontrada o fuera de tu alcance'; end if;
    if v_existing.employee_id<>p_employee_id then raise exception 'No se puede cambiar el integrante de una marcación existente'; end if;

    update public.hr_time_marks
    set marked_at=p_marked_at,mark_type=v_type,note=coalesce(note,v_reason),is_manual=true,
        corrected_at=now(),corrected_by=auth.uid(),correction_reason=v_reason
    where id=p_mark_id
    returning id into v_id;

    insert into public.hr_audit_log(actor_user_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'time_mark_corrected','time_mark',v_id::text,
      jsonb_build_object('employee_id',p_employee_id,'old_marked_at',v_existing.marked_at,
        'new_marked_at',p_marked_at,'old_mark_type',v_existing.mark_type,'new_mark_type',v_type,'reason',v_reason));
  end if;

  return v_id;
end;
$$;

revoke all on function public.hr_save_time_mark(bigint,uuid,timestamptz,text,text) from public,anon;
grant execute on function public.hr_save_time_mark(bigint,uuid,timestamptz,text,text) to authenticated;
