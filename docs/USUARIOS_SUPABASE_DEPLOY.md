# Black OS · Activación del sistema real de usuarios

El administrador de usuarios ya no usa registros locales del navegador. Los usuarios se crean, editan y eliminan en Supabase Auth y sus permisos se guardan en `app_metadata`.

## Paso obligatorio: desplegar la Edge Function

Función:

`supabase/functions/black-os-user-admin/index.ts`

### Opción A · Supabase CLI

Desde la raíz del repositorio:

```bash
supabase functions deploy black-os-user-admin --project-ref tjetppyqyzgxfhpuyoet
```

Supabase provee automáticamente a las Edge Functions las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

### Opción B · Dashboard de Supabase

1. Abrir Edge Functions en el proyecto BlackUsuario.
2. Crear una función llamada exactamente `black-os-user-admin`.
3. Copiar el contenido de `supabase/functions/black-os-user-admin/index.ts`.
4. Deploy.

## Comportamiento esperado

- Nuevo usuario: crea una cuenta real de Supabase Auth con email confirmado y contraseña temporal.
- Editar usuario: actualiza nombre, email, contraseña opcional, permisos y sucursales.
- Eliminar usuario: elimina la cuenta de Supabase Auth.
- Permisos: se almacenan en `app_metadata.black_os_permissions`.
- Módulos permitidos: se almacenan en `app_metadata.black_os_apps`.
- Sucursales: se almacenan en `app_metadata.black_os_branch_scope`.
- Los usuarios no pueden autoasignarse permisos porque `app_metadata` solo se modifica desde la función con service role.
- El portal oculta módulos no autorizados y también bloquea la apertura directa de módulos conocidos.

## Administrador principal

La función reconoce como administrador principal:

- el usuario con `app_metadata.black_os_super_admin = true`; o
- temporalmente, `leandro@blackoptica.ar`.

Si el email real del administrador principal es otro, conviene marcarlo explícitamente en Supabase Auth con `black_os_super_admin=true` en app metadata y luego retirar el fallback de email.
