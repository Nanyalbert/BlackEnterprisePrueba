create table if not exists public.hr_commission_import_batches (
 id uuid primary key default gen_random_uuid(),
 fingerprint text not null unique,
 period_from date not null,
 period_to date not null,
 files jsonb not null,
 settings jsonb not null,
 review_snapshot jsonb not null default '[]'::jsonb,
 imported_count integer not null default 0,
 skipped_count integer not null default 0,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 constraint valid_period check(period_from<=period_to)
);
alter table public.hr_commission_import_batches enable row level security;
revoke all on public.hr_commission_import_batches from public,anon,authenticated;

create or replace function public.hr_commissions_import(p_fingerprint text,p_from date,p_to date,p_files jsonb,p_settings jsonb,p_rows jsonb,p_review jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare batch_id uuid;item jsonb;new_id bigint;n integer:=0;v_ref text;v_data jsonb;
begin
 if auth.uid() is null or not public.black_os_has_permission('rrhh','commissions_manage') then raise exception 'Sin permiso para importar';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Período inválido';end if;
 if length(coalesce(p_fingerprint,''))<>64 then raise exception 'Huella de archivos inválida';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>2000 or jsonb_array_length(p_rows)=0 then raise exception 'Cantidad de movimientos inválida';end if;
 if jsonb_typeof(p_review)<>'array' or jsonb_array_length(p_review)>5000 then raise exception 'Lista de revisión inválida';end if;
 if exists(select 1 from public.hr_commission_import_batches where fingerprint=p_fingerprint) then raise exception 'Estos archivos ya fueron importados';end if;
 insert into public.hr_commission_import_batches(fingerprint,period_from,period_to,files,settings,review_snapshot,created_by)
 values(p_fingerprint,p_from,p_to,p_files,p_settings,p_review,auth.uid()) returning id into batch_id;
 for item in select value from jsonb_array_elements(p_rows) loop
   if (item->>'operation_date')::date not between p_from and p_to then raise exception 'Movimiento fuera de período';end if;
   v_ref:=batch_id::text||':'||n::text;
   v_data:=item||jsonb_build_object('source_type','excel','source_reference',v_ref);
   new_id:=public.hr_commissions_save(null,v_data,'Importación revisada desde Excel');
   n:=n+1;
 end loop;
 update public.hr_commission_import_batches set imported_count=n,skipped_count=jsonb_array_length(p_review) where id=batch_id;
 insert into public.hr_audit_log(actor_user_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'commissions_batch_imported','hr_commission_import_batch',batch_id::text,jsonb_build_object('count',n,'review',jsonb_array_length(p_review),'files',p_files,'settings',p_settings));
 return jsonb_build_object('batch_id',batch_id,'imported',n,'review',jsonb_array_length(p_review));
end $$;
create or replace function public.hr_commissions_import_history()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.black_os_has_permission('rrhh','commissions_view') then raise exception 'No autorizado';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into result
 from(select b.id,b.period_from,b.period_to,b.files,b.settings,b.imported_count,b.skipped_count,b.created_at
 from public.hr_commission_import_batches b
 where public.black_os_is_admin() or exists(
 select 1 from public.hr_commissions c join public.branches br on br.id=c.branch_id
 where c.source_reference like b.id::text||':%' and public.black_os_branch_allowed(br.code))
 order by b.created_at desc limit 100) x;
 return result;
end $$;
revoke all on function public.hr_commissions_import(text,date,date,jsonb,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.hr_commissions_import_history() from public,anon;
grant execute on function public.hr_commissions_import(text,date,date,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.hr_commissions_import_history() to authenticated;