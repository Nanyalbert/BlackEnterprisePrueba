-- Black OS · alcance total de sucursales
alter table public.profiles
  add column if not exists all_branches boolean not null default false;

update public.profiles p
set all_branches=true
where exists(
  select 1 from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where ur.user_id=p.id and r.code='admin'
);

-- La implementación productiva de black_os_branch_allowed() y
-- black_os_my_access() consulta profiles.all_branches. El panel de usuarios
-- sincroniza este valor cuando el administrador selecciona "Todas las sucursales".
