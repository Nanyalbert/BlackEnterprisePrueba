# Black OS — auditoría y endurecimiento (12-10-2026)

## Alcance de esta entrega
Rama `audit/hardening-users-20261012`; no se despliega automáticamente a producción.

### Implementado
- El administrador de usuarios rechaza sucursales vacías, desconocidas y el valor `all` combinado con sucursales específicas durante altas y modificaciones.
- Los borrados de relaciones de sucursales, permisos y roles en `syncDirectory` ya no descartan silenciosamente errores de Supabase.

### Comprobaciones obligatorias antes de fusionar
1. Verificar que la Edge Function desplegada corresponda a la versión controlada en Git.
2. Probar creación y modificación de usuarios con General Paz, Cerro y todas las sucursales.
3. Confirmar rechazo de `[]`, códigos desconocidos y `['all','general-paz']`.
4. Revisar en Supabase las funciones `black_os_my_access`, `black_os_has_permission` y `black_os_branch_allowed`, así como RLS de todas las tablas de datos comerciales.
5. Probar usuario desactivado y usuario de solo lectura (tanto mediante UI como llamadas directas a la API).
6. Respaldar datos y preparar rollback antes de desplegar.

### Riesgo aún abierto
`syncDirectory` orquesta múltiples escrituras independientes entre Auth y tablas SQL: puede producir actualizaciones parciales si falla una etapa. Requiere migración transaccional RPC con controles de autorización y pruebas de regresión. No sustituir por un borrado masivo o una migración sin respaldo.

### Próximas fases
- CI con pruebas sintácticas, de contratos y regresión de permisos.
- Consolidación de scripts CSS/JS heredados, preservando funcionalidad.
- Panel de diagnóstico administrativo sin exposición de información sensible.
- Pruebas end-to-end con cuentas restringidas y dos sucursales.
