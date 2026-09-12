-- ============================================================
-- BLACK OS — BLACK AI
-- BASE DE CONOCIMIENTO v1
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.black_ai_knowledge (
    id uuid primary key default gen_random_uuid(),
    category text not null check (category in ('price_product','promotion','commercial','policy')),
    title text not null check (length(trim(title)) > 0),
    content text not null default '',
    data jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    priority integer not null default 100,
    valid_from date,
    valid_until date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid,
    updated_by uuid
);

create index if not exists black_ai_knowledge_active_idx
    on public.black_ai_knowledge (is_active, category);

create index if not exists black_ai_knowledge_validity_idx
    on public.black_ai_knowledge (valid_from, valid_until);

alter table public.black_ai_knowledge enable row level security;

grant select, insert, update, delete on table public.black_ai_knowledge to authenticated;
revoke all on table public.black_ai_knowledge from anon;

drop policy if exists black_ai_knowledge_select_authenticated on public.black_ai_knowledge;
create policy black_ai_knowledge_select_authenticated
on public.black_ai_knowledge
for select
to authenticated
using (true);

drop policy if exists black_ai_knowledge_insert_authenticated on public.black_ai_knowledge;
create policy black_ai_knowledge_insert_authenticated
on public.black_ai_knowledge
for insert
to authenticated
with check (true);

drop policy if exists black_ai_knowledge_update_authenticated on public.black_ai_knowledge;
create policy black_ai_knowledge_update_authenticated
on public.black_ai_knowledge
for update
to authenticated
using (true)
with check (true);

drop policy if exists black_ai_knowledge_delete_authenticated on public.black_ai_knowledge;
create policy black_ai_knowledge_delete_authenticated
on public.black_ai_knowledge
for delete
to authenticated
using (true);

comment on table public.black_ai_knowledge is
'Fuente de verdad comercial aprobada para Black AI: precios/productos, promociones, información comercial y políticas.';
