-- Black OS · fuente de verdad de permisos en base
-- Evita depender de app_metadata/JWT para la autorización efectiva.

create table if not exists public.black_os_user_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  level text not null default 'none' check (level in ('none','read','operator','full','custom')),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id,module_id)
);

create index if not exists black_os_user_permissions_module_idx
  on public.black_os_user_permissions(module_id,user_id);

alter table public.black_os_user_permissions enable row level security;
revoke all on public.black_os_user_permissions from public,anon,authenticated;

-- En producción, black_os_has_module / black_os_has_permission /
-- black_os_branch_allowed y black_os_my_access usan esta tabla,
-- profiles.active y user_branches como fuente de verdad.
-- app_metadata se conserva como caché/compatibilidad de interfaz, no como
-- única barrera de autorización.
