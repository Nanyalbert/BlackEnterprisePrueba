-- Black OS · RRHH permissions hardening
-- Aplica alcance por sucursal y separa permisos de asistencia/reportes/datos salariales.

create or replace function public.black_os_branch_allowed(p_branch_code text)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_code text:=lower(trim(coalesce(p_branch_code,'')));
  v_scope jsonb;
begin
  if public.black_os_is_admin() then return true; end if;
  if v_code in ('alto-palermo','zona-norte','cerro') then v_code:='cerro-de-las-rosas'; end if;

  v_scope:=auth.jwt()->'app_metadata'->'black_os_branch_scope';
  if v_scope is null or jsonb_typeof(v_scope)<>'array' then return true; end if;
  if v_scope ? 'all' then return true; end if;
  if v_scope ? v_code then return true; end if;
  if v_code='cerro-de-las-rosas' and (v_scope ? 'alto-palermo' or v_scope ? 'zona-norte' or v_scope ? 'cerro') then return true; end if;
  return false;
end;
$$;

revoke all on function public.black_os_branch_allowed(text) from public;
grant execute on function public.black_os_branch_allowed(text) to authenticated;

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
  if not public.black_os_can_rrhh('view') then raise exception 'No autorizado'; end if;

  return query
  select
    e.id,e.auth_user_id,e.full_name,e.email,e.branch_id,b.code,b.name,
    e.tolerance_minutes,
    case when public.black_os_can_rrhh('salary_reference') then e.monthly_reference_salary else null end,
    e.active,
    (select s.start_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=1 and s.active limit 1),
    (select s.end_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=1 and s.active limit 1),
    (select s.start_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=6 and s.active limit 1),
    (select s.end_time from public.hr_employee_schedules s where s.employee_id=e.id and s.weekday=6 and s.active limit 1)
  from public.hr_employees e
  join public.branches b on b.id=e.branch_id
  where public.black_os_branch_allowed(b.code)
  order by e.active desc,e.full_name;
end;
$$;

-- hr_upsert_employee / hr_list_marks / hr_monthly_summary:
-- sus definiciones productivas están aplicadas en Supabase mediante la migración
-- rrhh_permissions_hardening. Este archivo conserva el objetivo y la trazabilidad
-- de la segunda etapa de seguridad. La fuente completa inicial sigue en 33_rrhh_foundation.sql.
