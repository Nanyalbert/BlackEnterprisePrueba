# Recetas en Black OS

Este módulo se abre desde `menu.html` y usa la misma sesión de Supabase Auth que Black OS. La lectura básica permanece en el navegador. La interpretación opcional con Black AI envía la imagen a `black-recetas-analyze`, una Supabase Edge Function de este mismo proyecto, que usa el secreto `OPENAI_API_KEY` ya empleado por Black AI. No hay otra clave en GitHub ni se necesita Cloudflare Workers.

## Activación

1. Publicar el frontend de `main` mediante GitHub Pages.
2. Desplegar la función: `supabase functions deploy black-recetas-analyze --project-ref tjetppyqyzgxfhpuyoet` (con JWT habilitado, que es el valor predeterminado). Si `OPENAI_API_KEY` todavía no existe en Edge Function Secrets, configurarlo allí, no en el repositorio.
3. Entrar a Black OS con un usuario de prueba, abrir **Recetas**, cargar una imagen y pulsar **Interpretar con Black AI**. Verificar OD, OI, signos, ejes y lejos/cerca contra el original antes de confirmar.

El frontend no guarda la foto ni el resultado en la base. Este primer enlace con Black OS reutiliza autenticación y backend, pero no asocia todavía la receta con un cliente o venta. La opción de interpretación queda visible si se carga una imagen; dará un error claro mientras la función o la clave no estén configuradas.

La pantalla de permisos del portal aún conserva parte de su estado en el navegador. La Edge Function verifica la sesión de Supabase, pero no aplica una política adicional por rol para este módulo. Antes de dar acceso a personal con distintas atribuciones, conviene trasladar esos permisos al backend.
