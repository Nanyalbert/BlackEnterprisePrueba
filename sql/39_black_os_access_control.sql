-- Black OS · Usuarios y permisos centrales
-- Archivo de referencia reproducible de la capa de control de acceso implementada en producción.

create table if not exists public.black_os_user_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references auth.users(id) on delete set null,
  target_user_id uuid null,
  action text not null,
  target_email text null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists black_os_user_audit_actor_idx
  on public.black_os_user_audit(actor_user_id,created_at desc);
create index if not exists black_os_user_audit_target_idx
  on public.black_os_user_audit(target_user_id,created_at desc);

alter table public.black_os_user_audit enable row level security;
revoke all on public.black_os_user_audit from public,anon,authenticated;

drop policy if exists black_os_user_audit_admin_select on public.black_os_user_audit;
create policy black_os_user_audit_admin_select
on public.black_os_user_audit for select to authenticated
using (public.is_blackos_admin());

create or replace function public.black_os_has_module(p_module text)
returns boolean
language plpgsql stable security definer set search_path=public
as $$
declare
  v_meta jsonb:=auth.jwt()->'app_metadata';
  v_cfg jsonb;
  v_profile_active boolean;
begin
  if public.black_os_is_admin() then return true; end if;
  select p.active into v_profile_active from public.profiles p where p.id=auth.uid();
  if v_profile_active is false then return false; end if;
  if coalesce((v_meta->>'black_os_active')::boolean,true)=false then return false; end if;
  v_cfg:=v_meta->'black_os_permissions'->p_module;
  if v_cfg is not null and coalesce(v_cfg->>'level','none')<>'none' then return true; end if;
  return coalesce(v_meta->'black_os_apps','[]'::jsonb) ? p_module;
end;
$$;

create or replace function public.black_os_has_permission(p_module text,p_permission text)
returns boolean
language plpgsql stable security definer set search_path=public
as $$
declare
  v_meta jsonb:=auth.jwt()->'app_metadata';
  v_cfg jsonb;
  v_level text;
  v_items jsonb;
  v_profile_active boolean;
begin
  if public.black_os_is_admin() then return true; end if;
  select p.active into v_profile_active from public.profiles p where p.id=auth.uid();
  if v_profile_active is false then return false; end if;
  if coalesce((v_meta->>'black_os_active')::boolean,true)=false then return false; end if;
  v_cfg:=v_meta->'black_os_permissions'->p_module;
  v_level:=coalesce(v_cfg->>'level','none');
  v_items:=v_cfg->'items';
  if v_level='none' then return false; end if;
  if p_permission is null or p_permission='' then return true; end if;
  if v_level='full' or v_items='"*"'::jsonb then return true; end if;
  return jsonb_typeof(v_items)='array' and v_items ? p_permission;
end;
$$;

grant execute on function public.black_os_has_module(text) to authenticated;
grant execute on function public.black_os_has_permission(text,text) to authenticated;
