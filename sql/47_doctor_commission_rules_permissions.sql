-- Black OS · permisos de reglas de comisión médica
drop policy if exists commission_rules_select on public.doctor_commission_rules;
drop policy if exists commission_rules_insert on public.doctor_commission_rules;
drop policy if exists commission_rules_update on public.doctor_commission_rules;
drop policy if exists commission_rules_delete on public.doctor_commission_rules;

create policy commission_rules_select_black_os
on public.doctor_commission_rules for select to authenticated
using (
  public.black_os_has_permission('crm-oftalmologos','stats')
  and public.black_os_branch_allowed((select code from public.branches where id=branch_id))
);

create policy commission_rules_insert_black_os
on public.doctor_commission_rules for insert to authenticated
with check (
  public.black_os_has_permission('crm-oftalmologos','stats')
  and public.black_os_branch_allowed((select code from public.branches where id=branch_id))
);

create policy commission_rules_update_black_os
on public.doctor_commission_rules for update to authenticated
using (
  public.black_os_has_permission('crm-oftalmologos','stats')
  and public.black_os_branch_allowed((select code from public.branches where id=branch_id))
)
with check (
  public.black_os_has_permission('crm-oftalmologos','stats')
  and public.black_os_branch_allowed((select code from public.branches where id=branch_id))
);

create policy commission_rules_delete_black_os
on public.doctor_commission_rules for delete to authenticated
using (
  public.black_os_has_permission('crm-oftalmologos','stats')
  and public.black_os_branch_allowed((select code from public.branches where id=branch_id))
);
