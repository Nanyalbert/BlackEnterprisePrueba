-- ============================================================
-- BLACK OS — MÓDULO MARKETING
-- Versión manual v1 · 2026-10-04
-- ============================================================
-- Ejecutar en Supabase SQL Editor antes de abrir Marketing.
-- No publica contenido ni activa campañas; solo persiste planificación.
-- ============================================================

create extension if not exists pgcrypto;

create or replace function public.black_marketing_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.marketing_options (
  id text primary key,
  kind text not null,
  label text not null,
  color text not null default '#7d7d78',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_options_kind_idx on public.marketing_options(kind, is_active, sort_order);

drop trigger if exists trg_marketing_options_touch on public.marketing_options;
create trigger trg_marketing_options_touch before update on public.marketing_options
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_contents (
  id uuid primary key default gen_random_uuid(),
  stable_id text not null unique,
  parent_id uuid references public.marketing_contents(id) on delete set null,
  title text not null,
  content_type_id text,
  theme_id text,
  format_id text,
  objective text,
  branch_id text,
  product_id uuid references public.black_ai_products(id) on delete set null,
  product_label text,
  promotion_label text,
  audience_zone text,
  responsible text,
  brief text,
  hook text,
  development text,
  script text,
  material text,
  cta text,
  channel text,
  destination text,
  recording_date date,
  review_date date,
  publish_date date,
  status_id text not null default 'idea',
  ad_decision_id text not null default 'organic',
  ad_status_id text not null default 'not_activated',
  attachments jsonb not null default '[]'::jsonb,
  notes text,
  results jsonb not null default '{}'::jsonb,
  source_name text,
  source_version text,
  source_hash text,
  source_payload jsonb not null default '{}'::jsonb,
  needs_review boolean not null default false,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_contents_publish_idx on public.marketing_contents(publish_date) where archived_at is null;
create index if not exists marketing_contents_filters_idx on public.marketing_contents(status_id, content_type_id, theme_id, branch_id, ad_decision_id) where archived_at is null;
create index if not exists marketing_contents_parent_idx on public.marketing_contents(parent_id);

drop trigger if exists trg_marketing_contents_touch on public.marketing_contents;
create trigger trg_marketing_contents_touch before update on public.marketing_contents
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_story_sequences (
  id uuid primary key default gen_random_uuid(),
  stable_id text not null unique,
  title text not null,
  content_id uuid references public.marketing_contents(id) on delete set null,
  branch_id text,
  objective text,
  cta text,
  channel text default 'stories',
  destination text,
  valid_from timestamptz,
  valid_until timestamptz,
  highlight_id text,
  status_id text not null default 'idea',
  source_version text,
  source_payload jsonb not null default '{}'::jsonb,
  notes text,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketing_story_sequences_touch on public.marketing_story_sequences;
create trigger trg_marketing_story_sequences_touch before update on public.marketing_story_sequences
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_story_frames (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.marketing_story_sequences(id) on delete cascade,
  sort_order integer not null default 10,
  text_content text,
  material text,
  cta text,
  channel text default 'stories',
  destination text,
  attachment jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_story_frames_sequence_idx on public.marketing_story_frames(sequence_id, sort_order);

drop trigger if exists trg_marketing_story_frames_touch on public.marketing_story_frames;
create trigger trg_marketing_story_frames_touch before update on public.marketing_story_frames
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_budget_pools (
  id uuid primary key default gen_random_uuid(),
  stable_id text not null unique,
  name text not null,
  scope text not null default 'campaign' check (scope in ('total','platform','campaign','adset','reserve')),
  platform text,
  parent_pool_id uuid references public.marketing_budget_pools(id) on delete set null,
  period_start date,
  period_end date,
  planned_amount numeric(14,2) not null default 0,
  actual_spend numeric(14,2) not null default 0,
  currency text not null default 'ARS',
  is_template boolean not null default false,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketing_budget_pools_touch on public.marketing_budget_pools;
create trigger trg_marketing_budget_pools_touch before update on public.marketing_budget_pools
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  stable_id text not null unique,
  name text not null,
  platform text not null default 'meta' check (platform in ('meta','google','other')),
  responsible text,
  status_id text not null default 'not_activated',
  commercial_objective text,
  platform_objective text,
  start_date date,
  end_date date,
  branch_id text,
  related_products jsonb not null default '[]'::jsonb,
  related_promotions jsonb not null default '[]'::jsonb,
  destination text,
  audience_type text,
  age_min integer check (age_min is null or age_min >= 13),
  age_max integer check (age_max is null or age_max >= coalesce(age_min,13)),
  interests text[] not null default '{}',
  exclusions text[] not null default '{}',
  geography jsonb not null default '{}'::jsonb,
  placements text[] not null default '{}',
  cta text,
  link text,
  utm jsonb not null default '{}'::jsonb,
  budget_pool_id uuid references public.marketing_budget_pools(id) on delete set null,
  planned_budget numeric(14,2),
  actual_spend numeric(14,2),
  currency text not null default 'ARS',
  period_label text,
  next_review date,
  kpi_name text,
  kpi_target numeric,
  cpa_target numeric,
  roas_target numeric,
  roas_target_source text,
  roas_target_date date,
  assumptions text,
  decision text,
  decision_reason text,
  decision_history jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_period_idx on public.marketing_campaigns(start_date, end_date, platform, status_id);

drop trigger if exists trg_marketing_campaigns_touch on public.marketing_campaigns;
create trigger trg_marketing_campaigns_touch before update on public.marketing_campaigns
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  stable_id text not null unique,
  name text not null,
  status_id text not null default 'not_activated',
  budget_pool_id uuid references public.marketing_budget_pools(id) on delete set null,
  audience jsonb not null default '{}'::jsonb,
  geography jsonb not null default '{}'::jsonb,
  placements text[] not null default '{}',
  start_date date,
  end_date date,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketing_ad_sets_touch on public.marketing_ad_sets;
create trigger trg_marketing_ad_sets_touch before update on public.marketing_ad_sets
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_ads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  ad_set_id uuid references public.marketing_ad_sets(id) on delete set null,
  content_id uuid references public.marketing_contents(id) on delete set null,
  stable_id text not null unique,
  name text not null,
  status_id text not null default 'not_activated',
  variant_label text,
  cta text,
  link text,
  utm jsonb not null default '{}'::jsonb,
  budget_pool_id uuid references public.marketing_budget_pools(id) on delete set null,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketing_ads_touch on public.marketing_ads;
create trigger trg_marketing_ads_touch before update on public.marketing_ads
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_results (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.marketing_contents(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  ad_set_id uuid references public.marketing_ad_sets(id) on delete set null,
  ad_id uuid references public.marketing_ads(id) on delete set null,
  branch_id text,
  period_start date not null,
  period_end date not null,
  source text not null default 'manual',
  attribution_key text,
  reach integer,
  impressions integer,
  plays integer,
  retention_pct numeric(7,3),
  interactions integer,
  profile_visits integer,
  saves integer,
  qualified_inquiries integer,
  quotes integer,
  sales integer,
  revenue numeric(14,2),
  contribution_before_ads numeric(14,2),
  spend numeric(14,2),
  lost_reason text,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_results_period_ck check (period_end >= period_start)
);
create unique index if not exists marketing_results_attribution_unique
  on public.marketing_results(attribution_key)
  where attribution_key is not null and btrim(attribution_key) <> '';

drop trigger if exists trg_marketing_results_touch on public.marketing_results;
create trigger trg_marketing_results_touch before update on public.marketing_results
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_suggestions (
  id uuid primary key default gen_random_uuid(),
  stable_id text unique,
  suggestion_type text not null,
  title text not null,
  proposal text not null,
  observed_data jsonb not null default '{}'::jsonb,
  rationale text,
  objective text,
  missing_validation text,
  status text not null default 'pending' check (status in ('pending','accepted','dismissed','snoozed')),
  snoozed_until date,
  source_links jsonb not null default '[]'::jsonb,
  accepted_content_id uuid references public.marketing_contents(id) on delete set null,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketing_suggestions_touch on public.marketing_suggestions;
create trigger trg_marketing_suggestions_touch before update on public.marketing_suggestions
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_reference_notes (
  id uuid primary key default gen_random_uuid(),
  stable_id text not null unique,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  source_version text,
  source_hash text,
  needs_review boolean not null default false,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_marketing_reference_notes_touch on public.marketing_reference_notes;
create trigger trg_marketing_reference_notes_touch before update on public.marketing_reference_notes
for each row execute function public.black_marketing_touch_updated_at();

create table if not exists public.marketing_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_version text,
  source_hash text,
  status text not null default 'preview' check (status in ('preview','applied','failed','cancelled')),
  summary jsonb not null default '{}'::jsonb,
  source_meta jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists public.marketing_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.marketing_import_batches(id) on delete cascade,
  entity_kind text not null,
  stable_id text not null,
  payload jsonb not null,
  action text not null default 'review' check (action in ('new','update','duplicate','review','skip','applied')),
  matched_id uuid,
  validation jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  unique(batch_id, entity_kind, stable_id)
);
create index if not exists marketing_import_rows_batch_idx on public.marketing_import_rows(batch_id, action);

create table if not exists public.marketing_audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index if not exists marketing_audit_log_row_idx on public.marketing_audit_log(table_name, row_id, changed_at desc);

create or replace function public.black_marketing_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.marketing_audit_log(table_name,row_id,action,after_data,changed_by)
    values (tg_table_name, coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'stable_id'), 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.marketing_audit_log(table_name,row_id,action,before_data,after_data,changed_by)
    values (tg_table_name, coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'stable_id'), 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    insert into public.marketing_audit_log(table_name,row_id,action,before_data,changed_by)
    values (tg_table_name, coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'stable_id'), 'DELETE', to_jsonb(old), auth.uid());
    return old;
  end if;
end;
$$;

-- Auditoría en entidades editables principales.
do $$
declare t text;
begin
  foreach t in array array[
    'marketing_options','marketing_contents','marketing_story_sequences','marketing_story_frames',
    'marketing_budget_pools','marketing_campaigns','marketing_ad_sets','marketing_ads',
    'marketing_results','marketing_suggestions','marketing_reference_notes'
  ] loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format('create trigger trg_%I_audit after insert or update or delete on public.%I for each row execute function public.black_marketing_audit()', t, t);
  end loop;
end $$;

-- RLS: v1 reutiliza la sesión existente de Black OS. Los permisos granulares actuales
-- del portal siguen siendo una capa de interfaz/localStorage y no son una fuente de
-- autorización de base de datos; por seguridad nunca se habilita anon.
do $$
declare t text;
begin
  foreach t in array array[
    'marketing_options','marketing_contents','marketing_story_sequences','marketing_story_frames',
    'marketing_budget_pools','marketing_campaigns','marketing_ad_sets','marketing_ads',
    'marketing_results','marketing_suggestions','marketing_reference_notes',
    'marketing_import_batches','marketing_import_rows','marketing_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_select', t);
    if t <> 'marketing_audit_log' then
      execute format('drop policy if exists %I on public.%I', t || '_authenticated_write', t);
      execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_authenticated_write', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
    if t <> 'marketing_audit_log' then
      execute format('grant insert, update, delete on public.%I to authenticated', t);
    end if;
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Configuración inicial editable. IDs estables: nunca se reutilizan para otro significado.
insert into public.marketing_options(id,kind,label,color,sort_order,metadata) values
('idea','production_status','Idea','#6f6f6b',10,'{}'),
('brief_validated','production_status','Brief validado','#8a7a58',20,'{}'),
('recorded','production_status','Grabado','#6d7f8d',30,'{}'),
('edited','production_status','Editado','#6f7797',40,'{}'),
('approved','production_status','Aprobado','#71866f',50,'{}'),
('scheduled','production_status','Programado','#6c8294',60,'{"help":"Tiene fecha interna; no publica automáticamente."}'),
('published','production_status','Publicado','#527a65',70,'{}'),
('analyzed','production_status','Analizado','#756b86',80,'{}'),
('commercial','content_type','Comercial o promoción','#a76c54',10,'{}'),
('demonstrative','content_type','Demostrativo','#8a8062',20,'{}'),
('technical','content_type','Técnico o educativo','#557c8d',30,'{}'),
('process','content_type','Procesos / fábrica / laboratorio / taller','#6d7962',40,'{}'),
('institutional','content_type','Institucional o sucursal','#7d6f8f',50,'{}'),
('service','content_type','Servicio y posventa','#5f7d72',60,'{}'),
('ugc','content_type','UGC','#8b6f78',70,'{}'),
('participatory','content_type','Disruptivo o participativo','#986d63',80,'{}'),
('personal','content_type','Personal o historia del negocio','#7a725f',90,'{}'),
('collaboration','content_type','Colaboración','#667b94',100,'{}'),
('reviews','content_type','Reseñas y prueba social','#69826d',110,'{}'),
('other','content_type','Otro','#686868',120,'{}'),
('reel_video','format','Reel / video','#6e7e8d',10,'{}'),
('story','format','Historia','#7f6f8a',20,'{}'),
('story_sequence','format','Secuencia de historias','#836c81',30,'{}'),
('carousel','format','Carrusel','#6f8177',40,'{}'),
('photo','format','Fotografía','#7f7969',50,'{}'),
('other_format','format','Otro','#707070',60,'{}'),
('new_branch','theme','Nueva sucursal','#7d6f8f',10,'{}'),
('clip_on','theme','Clip-on','#9a765c',20,'{}'),
('complete_glasses_promo','theme','Anteojos completos / promociones','#9b6654',30,'{}'),
('progressives','theme','Progresivos','#5d7e8a',40,'{}'),
('multifocals','theme','Multifocales','#547f92',50,'{}'),
('black_blue','theme','Black Blue','#4e738a',60,'{}'),
('black_protect','theme','Black Protect','#5e7d6d',70,'{}'),
('polarized','theme','Polarizados','#6b7688',80,'{}'),
('brands_capsules','theme','Marcas y cápsulas','#796f8b',90,'{}'),
('suppliers_factory','theme','Proveedores / fábrica','#6f7d62',100,'{}'),
('laboratory','theme','Laboratorio','#687963',110,'{}'),
('workshop','theme','Taller','#786e5d',120,'{}'),
('printing_3d','theme','Impresión 3D','#7a6f61',130,'{}'),
('aesthetics_thickness','theme','Estética y espesor','#6e7793',140,'{}'),
('contactology','theme','Contactología','#5f7b83',150,'{}'),
('special_cases','theme','Casos especiales','#6b7383',160,'{}'),
('ugc_theme','theme','UGC','#8b6f78',170,'{}'),
('reviews_theme','theme','Reseñas','#69826d',180,'{}'),
('collaborations','theme','Colaboraciones','#667b94',190,'{}'),
('hours','theme','Horarios','#777369',200,'{}'),
('holidays','theme','Feriados','#7f705f',210,'{}'),
('commercial_dates','theme','Fechas comerciales','#8d6b5b',220,'{}'),
('frames','theme','Armazones','#7b725f',230,'{}'),
('general','theme','General','#686868',240,'{}'),
('organic','ad_decision','Solo orgánico','#77736e',10,'{}'),
('candidate','ad_decision','Candidato a pauta','#5f856b',20,'{}'),
('conditional','ad_decision','Pauta condicional','#9a7e52',30,'{}'),
('not_activated','ad_status','Sin activar','#6c6c68',10,'{}'),
('testing','ad_status','En prueba','#957a4e',20,'{}'),
('active','ad_status','Activo','#588064',30,'{}'),
('paused','ad_status','Pausado','#8a675b',40,'{}'),
('finished','ad_status','Finalizado','#6f6f78',50,'{}'),
('reels_feed','channel','Reels / feed','#6c7d8d',10,'{}'),
('stories','channel','Stories','#7d6c88',20,'{}'),
('feed','channel','Feed','#6e796f',30,'{}'),
('other_channel','channel','Otro','#6a6a6a',40,'{}'),
('sales','objective','Ventas','#6f8565',10,'{}'),
('inquiries','objective','Consultas','#667f8d',20,'{}'),
('profile_visits','objective','Visitas al perfil','#796f8b',30,'{}'),
('store_traffic','objective','Tráfico a tienda','#8a745c',40,'{}'),
('awareness','objective','Reconocimiento','#74788c',50,'{}'),
('local_visits','objective','Visitas al local','#6a7e72',60,'{}'),
('whatsapp','destination','WhatsApp','#5f856b',10,'{}'),
('profile','destination','Perfil','#796f8b',20,'{}'),
('product','destination','Producto','#7d765f',30,'{}'),
('store','destination','Tienda','#8a745c',40,'{}'),
('branch','destination','Sucursal','#6a7e72',50,'{}'),
('other_destination','destination','Otro','#6a6a6a',60,'{}')
on conflict (id) do update set
  kind=excluded.kind,label=excluded.label,sort_order=excluded.sort_order,
  metadata=public.marketing_options.metadata || excluded.metadata;

-- Destacados sugeridos del plan.
insert into public.marketing_options(id,kind,label,color,sort_order) values
('highlight_cerro','highlight','Cerro','#786f88',10),
('highlight_general_paz','highlight','General Paz','#6e7c83',20),
('highlight_clip_on','highlight','Clip-on','#96745c',30),
('highlight_promos','highlight','Promociones','#9a6654',40),
('highlight_opiniones','highlight','Opiniones','#69826d',50),
('highlight_taller','highlight','Taller','#786e5d',60),
('highlight_marcas','highlight','Marcas','#796f8b',70),
('highlight_contactologia','highlight','Contactología','#5f7b83',80),
('highlight_colaboraciones','highlight','Colaboraciones','#667b94',90)
on conflict (id) do update set kind=excluded.kind,label=excluded.label,sort_order=excluded.sort_order;

-- Escenario presupuestario orientativo. Es plantilla, no gasto real.
insert into public.marketing_budget_pools(stable_id,name,scope,platform,planned_amount,currency,is_template,notes)
values ('BUDGET-TEMPLATE-550K-TOTAL','Escenario mensual de referencia ARS 550.000','total',null,550000,'ARS',true,'Referencia editable. La reserva está incluida dentro del total.')
on conflict (stable_id) do update set planned_amount=excluded.planned_amount,notes=excluded.notes,is_template=true;

with total as (
  select id from public.marketing_budget_pools where stable_id='BUDGET-TEMPLATE-550K-TOTAL'
)
insert into public.marketing_budget_pools(stable_id,name,scope,platform,parent_pool_id,planned_amount,currency,is_template,notes)
select x.stable_id,x.name,x.scope,x.platform,total.id,x.amount,'ARS',true,x.notes
from total
cross join (values
 ('BUDGET-TEMPLATE-550K-META','Meta · referencia','platform','meta',350000::numeric,'Parte del total; no sumar por anuncio.'),
 ('BUDGET-TEMPLATE-550K-GOOGLE','Google · referencia','platform','google',150000::numeric,'Parte del total.'),
 ('BUDGET-TEMPLATE-550K-RESERVE','Reserva · referencia','reserve',null,50000::numeric,'Reserva dentro del total; no es gasto adicional.')
) as x(stable_id,name,scope,platform,amount,notes)
on conflict (stable_id) do update set parent_pool_id=excluded.parent_pool_id,planned_amount=excluded.planned_amount,notes=excluded.notes,is_template=true;

-- Vista de métricas derivadas: no inventa ROAS/CPA si faltan denominadores.
create or replace view public.marketing_results_calculated as
select
  r.*,
  case when coalesce(r.qualified_inquiries,0) > 0 and r.spend is not null then r.spend / nullif(r.qualified_inquiries,0) end as cost_per_qualified_inquiry,
  case when coalesce(r.sales,0) > 0 and r.spend is not null then r.spend / nullif(r.sales,0) end as cpa_real,
  case when r.revenue is not null and r.spend is not null and r.spend > 0 and coalesce(r.sales,0) > 0 then r.revenue / r.spend end as roas_real,
  case when r.contribution_before_ads is not null and r.spend is not null then r.contribution_before_ads - r.spend end as contribution_after_ads
from public.marketing_results r;

grant select on public.marketing_results_calculated to authenticated;
revoke all on public.marketing_results_calculated from anon;

-- Preflight visible al final del SQL.
select
  (select count(*) from public.marketing_options) as option_count,
  (select count(*) from public.marketing_budget_pools where is_template) as budget_templates,
  to_regclass('public.marketing_contents') is not null as contents_ready,
  to_regclass('public.marketing_campaigns') is not null as campaigns_ready,
  to_regclass('public.marketing_results') is not null as results_ready;
