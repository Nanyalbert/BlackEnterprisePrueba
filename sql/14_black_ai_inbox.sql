create extension if not exists pgcrypto;

create table if not exists public.black_ai_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'evolution',
  event_name text not null,
  instance_name text,
  message_id text,
  remote_jid text,
  phone text,
  push_name text,
  from_me boolean not null default false,
  is_group boolean not null default false,
  message_type text,
  media_type text,
  text_content text,
  caption text,
  media_mimetype text,
  media_url text,
  has_media boolean not null default false,
  referral jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ai_status text not null default 'unprocessed' check (ai_status in ('unprocessed','classified','needs_review','processed','error')),
  ai_classification text,
  ai_analysis jsonb,
  received_at timestamptz not null default now(),
  provider_timestamp timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists black_ai_inbox_provider_message_uidx
  on public.black_ai_inbox(provider, message_id)
  where message_id is not null;
create index if not exists black_ai_inbox_received_idx on public.black_ai_inbox(received_at desc);
create index if not exists black_ai_inbox_phone_idx on public.black_ai_inbox(phone, received_at desc);

alter table public.black_ai_inbox enable row level security;
grant select, update on public.black_ai_inbox to authenticated;
revoke all on public.black_ai_inbox from anon;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='black_ai_inbox' and policyname='black_ai_inbox_auth_select'
  ) then
    create policy black_ai_inbox_auth_select on public.black_ai_inbox for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='black_ai_inbox' and policyname='black_ai_inbox_auth_update'
  ) then
    create policy black_ai_inbox_auth_update on public.black_ai_inbox for update to authenticated using (true) with check (true);
  end if;
end $$;

comment on table public.black_ai_inbox is 'Bandeja de eventos entrantes de WhatsApp/Evolution para Black AI. No almacena base64 de medios.';