-- CRM Black · alcance de usuarios de seguimiento
-- Un usuario con followup puede actualizar únicamente campos operativos de seguimiento.
-- Los datos comerciales del cliente requieren create_edit.

drop policy if exists clientes_insert_authenticated on public.clientes;
create policy clientes_insert_authenticated on public.clientes for insert to authenticated
with check (public.black_os_has_permission('crm-black','create_edit'));

create or replace function public.black_os_guard_cliente_update()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if public.black_os_has_permission('crm-black','create_edit') then
    return new;
  end if;

  if not public.black_os_has_permission('crm-black','followup') then
    raise exception 'No autorizado';
  end if;

  if new.nombre is distinct from old.nombre
     or new.tel is distinct from old.tel
     or new.ig is distinct from old.ig
     or new.fuente is distinct from old.fuente
     or new.etapa is distinct from old.etapa
     or new.prio is distinct from old.prio
     or new.producto is distinct from old.producto
     or new.monto is distinct from old.monto
     or new.opt_out is distinct from old.opt_out
     or new.created_at is distinct from old.created_at then
    raise exception 'Tu permiso permite seguimientos, pero no modificar datos comerciales del cliente';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_black_os_guard_cliente_update on public.clientes;
create trigger trg_black_os_guard_cliente_update
before update on public.clientes
for each row execute function public.black_os_guard_cliente_update();

revoke all on function public.black_os_guard_cliente_update() from public,anon,authenticated;
