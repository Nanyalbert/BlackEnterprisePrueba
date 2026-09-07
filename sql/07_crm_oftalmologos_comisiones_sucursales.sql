-- ============================================================
-- BLACK OS — CRM OFTALMÓLOGOS
-- COMISIONES POR SUCURSAL v1
-- General Paz + Alto Palermo
-- ============================================================

-- 1. Normalizar nombre definitivo de la segunda sucursal.
update public.branches
set code = 'alto-palermo', name = 'Alto Palermo'
where code = 'zona-norte';

-- 2. La base de médicos es global.
-- Recetas/derivaciones sí necesitan saber de qué sucursal provienen.
alter table public.prescriptions
add column if not exists branch_id uuid
references public.branches(id)
on delete restrict;

create index if not exists idx_prescriptions_branch
on public.prescriptions(branch_id);

-- 3. Historial de importaciones de Excel.
create table if not exists public.commission_imports (
    id uuid primary key default gen_random_uuid(),
    branch_id uuid not null
        references public.branches(id)
        on delete restrict,
    file_name text not null,
    period_from date,
    period_to date,
    records_count integer not null default 0
        check (records_count >= 0),
    total_amount numeric(14,2) not null default 0
        check (total_amount >= 0),
    duplicate_count integer not null default 0
        check (duplicate_count >= 0),
    status text not null default 'processed'
        check (status in ('processed','cancelled','error')),
    created_by uuid
        references public.profiles(id)
        on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_commission_imports_branch
on public.commission_imports(branch_id);

create index if not exists idx_commission_imports_created_at
on public.commission_imports(created_at desc);

-- 4. Evitar duplicados exactos dentro de la misma sucursal.
-- No se fuerza UNIQUE aquí porque los Excel actuales no exponen un id de venta estable.
-- La app usa sucursal + fecha + paciente + médico + monto como firma de importación.

-- 5. RLS queda habilitado desde el inicio.
alter table public.commission_imports enable row level security;

-- Las políticas específicas del CRM se crean en la migración de seguridad
-- junto con prescriptions, commission_rules y commission_payments.
