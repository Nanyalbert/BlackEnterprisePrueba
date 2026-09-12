-- ============================================================
-- BLACK OS — CRM OFTALMÓLOGOS
-- SYNC SUPABASE v1
-- ============================================================

-- 1. Huella estable de cada receta importada.
alter table public.prescriptions
add column if not exists import_fingerprint text;

create unique index if not exists uq_prescriptions_branch_fingerprint
on public.prescriptions(branch_id, import_fingerprint)
where import_fingerprint is not null;

-- 2. Evitar duplicar pagos del mismo médico/sucursal/período.
create unique index if not exists uq_commission_payment_period
on public.doctor_commission_payments(
    doctor_id,
    branch_id,
    period_from,
    period_to
);

-- 3. Índices útiles para lectura del dashboard.
create index if not exists idx_commission_rules_branch_doctor
on public.doctor_commission_rules(branch_id, doctor_id);

create index if not exists idx_commission_payments_branch_period
on public.doctor_commission_payments(branch_id, period_from, period_to);

-- 4. RLS ya fue habilitado en la migración 08.
-- No se agregan nuevas políticas porque import_fingerprint
-- pertenece a prescriptions y queda cubierto por sus políticas existentes.
