-- Black Fichada · soporte de terminal y protección contra fuerza bruta
-- No incluye secretos de terminal. Los secretos se provisionan fuera del repositorio.

create table if not exists public.hr_terminal_pin_attempts (
  id bigint generated always as identity primary key,
  terminal_code text not null,
  client_hash text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists hr_terminal_pin_attempts_lookup_idx
  on public.hr_terminal_pin_attempts(terminal_code,client_hash,created_at desc);

alter table public.hr_terminal_pin_attempts enable row level security;
revoke all on public.hr_terminal_pin_attempts from public,anon,authenticated;

alter table public.hr_terminals
  add column if not exists secret_hash text null,
  add column if not exists last_seen_at timestamptz null;

-- La función de validación usa pgcrypto y queda disponible únicamente para service_role.
create or replace function public.hr_validate_terminal_secret(p_terminal_code text,p_secret text)
returns table(terminal_code text,terminal_name text,branch_code text,branch_name text)
language sql stable security definer set search_path=public,extensions
as $$
  select t.code,t.name,b.code,b.name
  from public.hr_terminals t
  join public.branches b on b.id=t.branch_id
  where t.active=true
    and t.code=p_terminal_code
    and t.secret_hash=extensions.crypt(p_secret,t.secret_hash)
  limit 1;
$$;

revoke all on function public.hr_validate_terminal_secret(text,text) from public,anon,authenticated;
grant execute on function public.hr_validate_terminal_secret(text,text) to service_role;
