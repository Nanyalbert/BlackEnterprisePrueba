-- Black OS general database maintenance
-- Safe, non-destructive performance and RLS optimizations.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_blackos_admin()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select public.is_blackos_admin()))
with check (id = (select auth.uid()) or (select public.is_blackos_admin()));

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select to authenticated
using (
  (select public.is_blackos_admin())
  or exists (
    select 1 from public.user_branches ub
    where ub.branch_id=branches.id and ub.user_id=(select auth.uid())
  )
);

drop policy if exists user_branches_select on public.user_branches;
create policy user_branches_select on public.user_branches for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_blackos_admin()));

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_blackos_admin()));

drop policy if exists marketing_ad_sets_authenticated_select on public.marketing_ad_sets;
drop policy if exists marketing_ads_authenticated_select on public.marketing_ads;
drop policy if exists marketing_budget_pools_authenticated_select on public.marketing_budget_pools;
drop policy if exists marketing_campaigns_authenticated_select on public.marketing_campaigns;
drop policy if exists marketing_contents_authenticated_select on public.marketing_contents;
drop policy if exists marketing_import_batches_authenticated_select on public.marketing_import_batches;
drop policy if exists marketing_import_rows_authenticated_select on public.marketing_import_rows;
drop policy if exists marketing_key_date_plans_authenticated_select on public.marketing_key_date_plans;
drop policy if exists marketing_options_authenticated_select on public.marketing_options;
drop policy if exists marketing_reference_notes_authenticated_select on public.marketing_reference_notes;
drop policy if exists marketing_results_authenticated_select on public.marketing_results;
drop policy if exists marketing_story_frames_authenticated_select on public.marketing_story_frames;
drop policy if exists marketing_story_sequences_authenticated_select on public.marketing_story_sequences;
drop policy if exists marketing_suggestions_authenticated_select on public.marketing_suggestions;

create index if not exists black_ai_case_state_last_inbox_idx on public.black_ai_case_state(last_inbox_id);
create index if not exists black_ai_followup_opportunities_scenario_idx on public.black_ai_followup_opportunities(scenario_id);
create index if not exists black_ai_import_rows_batch_idx on public.black_ai_import_rows(batch_id);
create index if not exists black_ai_products_last_import_batch_idx on public.black_ai_products(last_import_batch_id);
create index if not exists black_ai_quote_evaluations_profile_key_idx on public.black_ai_quote_evaluations(profile_key);

create index if not exists prescriptions_branch_idx on public.prescriptions(branch_id);
create index if not exists prescriptions_doctor_fk_idx on public.prescriptions(doctor_id);
create index if not exists prescriptions_institution_idx on public.prescriptions(institution_id);
create index if not exists prescriptions_created_by_idx on public.prescriptions(created_by);

create index if not exists commission_imports_created_by_idx on public.commission_imports(created_by);
create index if not exists doctor_commission_payments_created_by_idx on public.doctor_commission_payments(created_by);
create index if not exists doctor_followups_created_by_idx on public.doctor_followups(created_by);
create index if not exists doctors_created_by_idx on public.doctors(created_by);

create index if not exists marketing_ad_sets_campaign_idx on public.marketing_ad_sets(campaign_id);
create index if not exists marketing_ad_sets_budget_pool_idx on public.marketing_ad_sets(budget_pool_id);
create index if not exists marketing_ads_campaign_idx on public.marketing_ads(campaign_id);
create index if not exists marketing_ads_ad_set_idx on public.marketing_ads(ad_set_id);
create index if not exists marketing_ads_content_idx on public.marketing_ads(content_id);
create index if not exists marketing_ads_budget_pool_idx on public.marketing_ads(budget_pool_id);
create index if not exists marketing_campaigns_budget_pool_idx on public.marketing_campaigns(budget_pool_id);
create index if not exists marketing_results_content_idx on public.marketing_results(content_id);
create index if not exists marketing_results_campaign_idx on public.marketing_results(campaign_id);
create index if not exists marketing_results_ad_set_idx on public.marketing_results(ad_set_id);
create index if not exists marketing_results_ad_idx on public.marketing_results(ad_id);
create index if not exists marketing_story_sequences_content_idx on public.marketing_story_sequences(content_id);
create index if not exists marketing_suggestions_accepted_content_idx on public.marketing_suggestions(accepted_content_id);
