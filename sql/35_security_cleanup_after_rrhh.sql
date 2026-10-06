-- Security cleanup after RRHH
alter view public.marketing_results_calculated set (security_invoker = true);

alter function public.black_marketing_touch_updated_at()
  set search_path = public;

revoke execute on function public.black_ai_sync_quote_followup_from_case() from anon, authenticated;
revoke execute on function public.black_marketing_audit() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

revoke execute on function public.can_access_branch(uuid) from anon;
revoke execute on function public.is_blackos_admin() from anon;

create index if not exists hr_audit_log_actor_user_idx
  on public.hr_audit_log(actor_user_id)
  where actor_user_id is not null;

create index if not exists hr_terminals_branch_idx
  on public.hr_terminals(branch_id);

create index if not exists hr_time_marks_corrected_by_idx
  on public.hr_time_marks(corrected_by)
  where corrected_by is not null;
