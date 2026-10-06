-- Complete safe foreign-key index coverage.

create index if not exists doctor_institutions_institution_idx
  on public.doctor_institutions(institution_id);

create index if not exists doctor_schedules_institution_idx
  on public.doctor_schedules(institution_id);

create index if not exists marketing_budget_pools_parent_idx
  on public.marketing_budget_pools(parent_pool_id);

create index if not exists marketing_contents_product_idx
  on public.marketing_contents(product_id);

create index if not exists user_branches_branch_idx
  on public.user_branches(branch_id);

create index if not exists user_roles_role_idx
  on public.user_roles(role_id);
