# Black OS — Accesos, usuarios y seguridad

## Regla principal

Black OS aplica permisos en tres capas. Ninguna capa reemplaza a las otras:

1. **Portal:** un usuario solo ve los módulos que tiene asignados.
2. **Interfaz del módulo:** dentro del módulo solo aparecen pestañas y acciones habilitadas.
3. **Supabase / RLS:** aunque alguien intente llamar la API manualmente, la base vuelve a validar módulo, acción, sucursal y estado del usuario.

Los permisos nunca deben implementarse solamente ocultando botones.

## Administrador principal

El administrador principal gestiona usuarios desde **Sistema → Usuarios**. Puede:

- crear, editar, desactivar y eliminar usuarios;
- asignar módulos;
- asignar funciones puntuales dentro de cada módulo;
- limitar el alcance a General Paz, Cerro de las Rosas o ambas;
- revisar el último acceso;
- consultar la auditoría de cambios de permisos.

El administrador principal no se edita ni elimina desde el panel de usuarios.

## Módulos y permisos

- CRM Black: lectura, edición, seguimiento, automatizaciones y exportación.
- Administración: resumen, ventas, utilidad/costos, caja, bancos, obra social, proveedores y cargas.
- CRM Oftalmólogos: lectura, profesionales, derivaciones y estadísticas/comisiones.
- Recetas: uso, interpretación con Black AI y copia de alternativas.
- Marketing: planificación, contenido, producción, pauta, resultados, importación y configuración.
- RRHH: equipo, gestión, fichadas, reportes, remuneración de referencia y configuración.
- Catálogo de cristales: consulta, edición técnica, precios e importación.
- Turnos: preparado para permisos granulares cuando el módulo termine de integrarse al shell principal.

## Alcance por sucursal

Códigos canónicos:

- `general-paz`
- `cerro-de-las-rosas`

Los alias históricos `alto-palermo`, `zona-norte` y `cerro` se normalizan a Cerro de las Rosas.

## Usuarios desactivados

La desactivación se guarda tanto en Auth metadata como en `profiles.active`. El portal refresca la sesión al iniciar y la base también consulta `profiles.active`, por lo que un token viejo no mantiene permisos operativos.

## Auditoría

La tabla `black_os_user_audit` registra alta, modificación y eliminación de usuarios. Nunca se almacenan contraseñas; solo se registra si una contraseña fue cambiada.

## Black Fichada

Black Fichada es una terminal separada. No utiliza el login normal de Black OS.

- valida una credencial de terminal;
- recibe el PIN;
- aplica rate limiting;
- registra la hora del servidor;
- no expone hashes de PIN al navegador;
- la administración se realiza exclusivamente desde RRHH.

Las credenciales de terminal no deben guardarse en este repositorio.

## Convención para módulos nuevos

Todo módulo nuevo debe incorporar:

- identificador estable en Auth metadata;
- permisos declarados en `assets/js/permisos.js`;
- visibilidad en `assets/js/portal.js`;
- acciones internas en `assets/js/module-access.js`;
- RLS o RPC seguras en Supabase;
- auditoría cuando modifique información sensible.
