-- ============================================================
-- BLACK OS — BLACK AI
-- PERMISOS DE TABLA v1
-- ============================================================

-- Las políticas RLS definen QUÉ filas puede usar el usuario.
-- Estos GRANT habilitan al rol authenticated a ejecutar las operaciones.
grant select, insert, update on table public.black_ai_settings to authenticated;

-- Black AI no debe ser accesible para sesiones anónimas.
revoke all on table public.black_ai_settings from anon;

-- Mantener RLS activo.
alter table public.black_ai_settings enable row level security;
