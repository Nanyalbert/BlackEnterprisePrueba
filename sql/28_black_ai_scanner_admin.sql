-- Escáner de recetas: control de edición de fichas técnicas y reglas comerciales.
-- Ejecutar en Supabase SQL Editor como propietario del proyecto.
-- Después, asignar al administrador con:
-- insert into public.black_ai_scanner_admins(user_id)
-- select id from auth.users where email = 'ADMIN@EJEMPLO.COM'
-- on conflict do nothing;

create table if not exists public.black_ai_scanner_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.black_ai_scanner_admins enable row level security;
revoke all on public.black_ai_scanner_admins from anon, authenticated;
grant select on public.black_ai_scanner_admins to authenticated;
drop policy if exists scanner_admin_self on public.black_ai_scanner_admins;
create policy scanner_admin_self on public.black_ai_scanner_admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.black_ai_scanner_write_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() = 'service_role' or exists (
    select 1 from public.black_ai_scanner_admins where user_id = auth.uid()
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Solo un administrador del escáner puede modificar fichas y matriz técnica.'
    using errcode = '42501';
end;
$$;
revoke all on function public.black_ai_scanner_write_guard() from public;

drop trigger if exists black_ai_products_scanner_admin on public.black_ai_products;
create trigger black_ai_products_scanner_admin
before insert or update or delete on public.black_ai_products
for each row execute function public.black_ai_scanner_write_guard();

drop trigger if exists black_ai_matrix_scanner_admin on public.black_ai_optical_matrix;
create trigger black_ai_matrix_scanner_admin
before insert or update or delete on public.black_ai_optical_matrix
for each row execute function public.black_ai_scanner_write_guard();
