-- ============================================================
-- BLACK OS — BLACK AI
-- IMPORTACION INCREMENTAL DE CATALOGO v1
-- ============================================================

alter table public.black_ai_products
  add column if not exists source_system text,
  add column if not exists source_key text,
  add column if not exists last_import_batch_id uuid references public.black_ai_import_batches(id) on delete set null,
  add column if not exists imported_at timestamptz;

create unique index if not exists black_ai_products_source_unique_idx
  on public.black_ai_products (source_system, source_key)
  where source_system is not null and source_key is not null;

create index if not exists black_ai_products_source_idx
  on public.black_ai_products (source_system, is_active);

comment on column public.black_ai_products.source_system is
'Sistema de origen del articulo importado. Ejemplo: sinergia.';

comment on column public.black_ai_products.source_key is
'Clave estable generada desde los datos del sistema de origen para actualizar sin duplicar.';

comment on column public.black_ai_products.last_import_batch_id is
'Ultimo lote que creo o actualizo este producto.';

comment on column public.black_ai_products.imported_at is
'Fecha/hora de la ultima sincronizacion desde el sistema externo.';

-- El usuario autenticado ya posee permisos CRUD por sql/13.
-- Reafirmamos lectura/escritura para que el importador del CRM pueda operar.
grant select, insert, update on table public.black_ai_products to authenticated;
grant select, insert, update on table public.black_ai_import_batches to authenticated;
grant select, insert, update on table public.black_ai_import_rows to authenticated;

-- La Edge Function podra consumir el catalogo ya importado.
grant select on table public.black_ai_products to service_role;

-- NOTA:
-- La importacion comercial NO modifica los rangos tecnicos
-- sphere/cylinder/addition ya cargados en cada producto.
-- Solo actualiza identidad comercial, clasificacion inferible y precio.
