-- Black OS · normalización semántica de niveles de acceso
-- Evita que el preset "Solo lectura" conserve accidentalmente permisos de escritura.

create or replace function public.black_os_normalize_user_permission_row()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if new.level='none' then
    new.items='[]'::jsonb;
  elsif new.level='full' then
    new.items='"*"'::jsonb;
  elsif new.level='read' then
    new.items:=case new.module_id
      when 'crm-black' then '["view"]'::jsonb
      when 'administracion' then '["summary","sales","cash","bank","social","suppliers"]'::jsonb
      when 'crm-oftalmologos' then '["view"]'::jsonb
      when 'recetas' then '["view"]'::jsonb
      when 'marketing' then '["view"]'::jsonb
      when 'rrhh' then '["view"]'::jsonb
      when 'catalogo' then '["view"]'::jsonb
      when 'turnos' then '["view"]'::jsonb
      else '[]'::jsonb
    end;
  end if;
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_black_os_normalize_user_permission_row on public.black_os_user_permissions;
create trigger trg_black_os_normalize_user_permission_row
before insert or update on public.black_os_user_permissions
for each row execute function public.black_os_normalize_user_permission_row();

update public.black_os_user_permissions set updated_at=updated_at;

revoke all on function public.black_os_normalize_user_permission_row() from public,anon,authenticated;
