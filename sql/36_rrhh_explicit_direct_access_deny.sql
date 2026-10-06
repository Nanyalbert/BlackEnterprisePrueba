-- RRHH explicit direct-access deny + SECURITY DEFINER cleanup
revoke execute on function public.black_ai_sync_quote_followup_from_case() from public, anon, authenticated;
revoke execute on function public.black_marketing_audit() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.can_access_branch(uuid) from public, anon;
grant execute on function public.can_access_branch(uuid) to authenticated;

revoke execute on function public.is_blackos_admin() from public, anon;
grant execute on function public.is_blackos_admin() to authenticated;

revoke execute on function public.black_os_is_admin() from public, anon, authenticated;
revoke execute on function public.black_os_can_rrhh(text) from public, anon, authenticated;
revoke execute on function public.black_os_branch_allowed(text) from public, anon, authenticated;

drop policy if exists "rrhh_no_direct_access_employees" on public.hr_employees;
create policy "rrhh_no_direct_access_employees" on public.hr_employees
for all to authenticated using(false) with check(false);

drop policy if exists "rrhh_no_direct_access_schedules" on public.hr_employee_schedules;
create policy "rrhh_no_direct_access_schedules" on public.hr_employee_schedules
for all to authenticated using(false) with check(false);

drop policy if exists "rrhh_no_direct_access_terminals" on public.hr_terminals;
create policy "rrhh_no_direct_access_terminals" on public.hr_terminals
for all to authenticated using(false) with check(false);

drop policy if exists "rrhh_no_direct_access_marks" on public.hr_time_marks;
create policy "rrhh_no_direct_access_marks" on public.hr_time_marks
for all to authenticated using(false) with check(false);

drop policy if exists "rrhh_no_direct_access_audit" on public.hr_audit_log;
create policy "rrhh_no_direct_access_audit" on public.hr_audit_log
for all to authenticated using(false) with check(false);
