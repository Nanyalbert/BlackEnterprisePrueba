# Auditoría previa · módulo Marketing

Fecha: 2026-10-04

## Arquitectura observada

Black OS es una aplicación web estática HTML/CSS/JS. El shell principal está en `menu.html` y abre módulos mediante iframes. La sesión Supabase y la key publishable se centralizan en `assets/js/supabase-config.js`. No existe un `package.json` ni un pipeline de build global; los tests automatizados actuales están concentrados en módulos concretos.

## Hallazgos confirmados

1. **Autenticación.** `portal.js` valida una sesión Supabase antes de habilitar el portal. Marketing reutiliza esa sesión y no introduce secretos en frontend.
2. **Permisos.** El editor granular de `assets/js/permisos.js` persiste la configuración en `localStorage`. Eso sirve para UX, pero no constituye autorización de base de datos. Marketing se integra al mismo editor para no crear un sistema paralelo; sus tablas habilitan RLS, revocan `anon` y en v1 permiten acceso a usuarios autenticados. Una futura migración de roles/permisos a Supabase permitirá políticas por permiso real.
3. **Usuarios.** La pantalla de usuarios del portal mantiene datos locales/demo; no se creó otro directorio de usuarios.
4. **Persistencia heredada.** Algunos módulos históricos aún dependen de `localStorage`. No se migraron porque sería una reescritura ajena al alcance y con riesgo de regresión. Marketing persiste su operación en Supabase.
5. **Navegación.** El shell usa `TITLES`, `MODULE_VIEWS` y sizing compartido para iframes. Marketing se integra por esa misma convención.
6. **Build y pruebas.** No hay build global que ejecutar. La validación aplicable es sintaxis JS, tests Node disponibles, integridad de la fuente canónica y revisión de referencias/rutas.
7. **Documentación general.** `LEEME.txt` está desactualizado respecto del repositorio actual. No afecta runtime, por lo que no se reescribió durante esta integración.

## Decisión de integración

Marketing se implementa como módulo aislado con `marketing.html`, CSS/JS propios y tablas específicas en Supabase. Reutiliza el catálogo existente mediante `black_ai_products` cuando corresponde. No conecta cuentas publicitarias, no publica contenido y no activa campañas.

## Seguridad y privacidad

- Marketing no almacena recetas ni datos clínicos.
- No deben incluirse datos sensibles en UTMs, enlaces o segmentación.
- Reseñas y UGC requieren fuente/permisos cuando corresponda.
- La fuente editorial no certifica precios, stock ni prestaciones: esos datos permanecen sujetos a validación.

## Fuente editorial e importación

La fuente canónica v10 se guarda en `data/marketing-plan-v10.json.gz`. Incluye 96 piezas con IDs estables, briefs completos, bloques Meta Ads, 12 plantillas de historias, destacados, referencias de marcas/cápsulas y notas globales. El importador siempre genera una previsualización y aplica altas/actualizaciones por ID estable.

## Limitaciones conocidas

- La autorización granular de Marketing todavía no puede llevarse a RLS por usuario hasta que los permisos del portal sean persistidos en una fuente server-side.
- La primera versión usa carga y medición manual de campañas/resultados, por diseño.
- No se incluyó una paleta proveniente de Excel porque no se recibió un Excel de categorías/colores en esta entrega; se usa una paleta editable de alto contraste.
