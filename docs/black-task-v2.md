# Black Task V2 — especificación de producto e integración

Estado: propuesta técnica; no implementada. Antes de codificar, identificar el módulo actual, su router, componentes, almacenamiento, autenticación y controles de acceso. No reemplazar datos existentes.

## Objetivo
Un sistema de gestión diaria de tareas de Black OS que permita capturar, organizar, completar y auditar tareas desde una interfaz de checklist y, mediante integración segura, desde mensajes de ChatGPT (texto o transcripción de voz).

## Experiencia
- Vista principal «Hoy»: entrada rápida, pendientes ordenados por prioridad y vencimiento, checkboxes visibles, progreso diario, completadas colapsables.
- Pestañas: Hoy, Próximas, Atrasadas, Todas y Actividad. Filtros por sucursal, proyecto, responsable y prioridad.
- Acciones sin fricción: marcar/desmarcar, editar título, fecha, mover, posponer, duplicar, archivar. Confirmación o deshacer para cambios destructivos.
- Tareas con checklist interno, descripción, notas, enlaces y archivos; indicador de avance.
- Accesible, responsive, atajos de teclado, estados vacíos y carga/error, zonas táctiles amplias, contraste compatible con diseño Black OS.
- Respetar configuraciones y estilos existentes de la aplicación; evitar cambios a otros módulos.

## Modelo de datos sugerido
tasks: id UUID, tenant_id, title, description, status(todo|in_progress|blocked|done|archived), priority(low|normal|high|urgent), due_at timestamptz NULL, due_date date NULL, timezone, scheduled_for date NULL, branch_id NULL, project_id NULL, assigned_to NULL, created_by, source(manual|chatgpt|voice|integration), completed_at NULL, completed_by NULL, recurrence_rule NULL, parent_task_id NULL, position, created_at, updated_at, version.
task_checklist_items: id, task_id, text, checked_at NULL, checked_by NULL, position, created_at, updated_at.
task_activity: id, task_id, actor_id, operation, before JSONB, after JSONB, created_at.
task_ingestion: id, user_id, idempotency_key UNIQUE scoped to tenant, raw_text, parsed_action, status, created_at.
Agregar índices por tenant_id, assigned_to, due_date, status. Asegurar RLS en todas las tablas; autorización de organización/sucursal y owner; migración sin perder información existente.

## Semántica
- Checklist tildado: status=done, completed_at y completed_by; deshacer cambia a todo y registra auditoría.
- Cuando todas las subtareas se completan, sugerir (no imponer) cerrar tarea padre.
- Tareas sin fecha quedan en bandeja de entrada y no se pierden.
- Fecha/hora interpretada con zona America/Argentina/Cordoba por defecto del usuario; registrar ISO 8601.
- Recurrencias generan instancias con identificador determinista / idempotencia para impedir duplicados; no alterar retrospectivamente períodos terminados.
- Descartar o revisar duplicados semánticos; no borrar automáticamente.
- Una tarea 'bloqueada' continúa visible en seguimiento; atraso se calcula del vencimiento, no de la fecha de creación.

## Asistente / integración ChatGPT
No basta conectar GitHub: el repo contiene código, no una API de datos de tareas de producción. Para realizar altas/cambios reales desde este chat es necesaria una integración con endpoint autenticado o herramienta/conector Black Task accesible a ChatGPT.
- API restringida: GET /tasks, POST /tasks, PATCH /tasks/:id, POST /tasks/:id/complete, POST /tasks/:id/reopen, POST /tasks/bulk, GET /tasks/activity.
- OAuth o identidad delegada, tokens de alcance mínimo, logs, rate limits, idempotencia, validación de permisos; nunca exponer claves privilegiadas en cliente ni repositorio.
- Traducir audio a texto primero (cliente/ChatGPT); extraer múltiples acciones y entidades; detectar ambigüedad. Confirmar antes de cancelar/borrar masivamente o reasignar tareas importantes.
- Ejemplo: «Agregá pagar a Facu hoy, llamar a Diego mañana y marcá Meta como hecho» => crear dos tareas y resolver identificación inequívoca de tercera antes de completar.
- Devolver por cada acción resultado concreto y errores parciales, no afirmar que se guardó si falló.
- Una captura personal no debe cambiar tareas de otras personas sin permisos.
- Opcional: agregar widget web propio de entrada por voz con consentimiento del usuario; no confundir reconocimiento de voz con vinculación del asistente externo.

## Calidad / aceptación
1. Crear 1 y N tareas con un mensaje; extracción de fechas relativas y prioridades.
2. Checkbox persiste tras recargar, múltiples dispositivos y errores de red; marcar/desmarcar conserva historial.
3. Subtareas y progreso correcto; filtro de completadas y atrasadas.
4. Aislamiento entre sucursales, empresas y usuarios; acceso denegado a ajenos.
5. Idempotencia para reintentos y creación recurrente; sin duplicaciones.
6. Móvil 375px y escritorio 1440px: sin desbordes; teclado, lector de pantalla, labels accesibles.
7. Guardado optimista con reversión y mensaje si falla; estados vacíos y errores.
8. Migrar tareas antiguas sin perder datos, IDs, fechas o asignaciones.
9. Tests unitarios de fechas/recurrencia, integración de API/RLS y E2E checklist/carga masiva.
10. Validar deployment con variables de entorno existentes; no desplegar ni tocar producción sin verificar el entorno.

## Implementación ordenada
A. Leer código real y arquitectura actual; elaborar diferencias respecto a este plan.
B. Refactorizar persistencia, RLS y migración.
C. Desarrollar UI checklist, filtros y captura rápida.
D. API de acciones autenticadas y parser de instrucciones en lenguaje natural.
E. Tests, despliegue en preview, validación móvil/escritorio y revisión de seguridad.
F. Conectar ChatGPT únicamente cuando exista interfaz de herramientas autorizada y probada.

## Ejemplos de tareas iniciales (NO cargadas)
- Liquidar comisiones
- Revisar facturación y remitos del Ministerio
- Pagar a Facu
- Renovar carnet
- Gestionar accesos/licencias de Meta
- Imprimir piezas 3D para Gonzalo

No crear datos reales a partir de ejemplos sin confirmar estado actual y deduplicar.
