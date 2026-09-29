# Recetas en Black OS

Este módulo se abre desde `menu.html` y usa la misma sesión de Supabase Auth que Black OS. La foto permanece en el navegador hasta que se pulsa **Interpretar receta**; entonces se envía a `black-recetas-analyze`, una Supabase Edge Function de este mismo proyecto, que usa el secreto `OPENAI_API_KEY` ya empleado por Black AI. No se usa el OCR local: la lectura manuscrita queda como borrador para cotejar con el original. No hay otra clave en GitHub ni se necesita Cloudflare Workers.

## Activación

1. Publicar el frontend de `main` mediante GitHub Pages.
2. Desplegar la función: `supabase functions deploy black-recetas-analyze --project-ref tjetppyqyzgxfhpuyoet` (con JWT habilitado, que es el valor predeterminado). Si `OPENAI_API_KEY` todavía no existe en Edge Function Secrets, configurarlo allí, no en el repositorio.
3. Entrar a Black OS con un usuario de prueba, abrir **Recetas**, cargar una imagen y pulsar **Interpretar con Black AI**. Verificar OD, OI, signos, ejes y lejos/cerca contra el original antes de confirmar.

El frontend no guarda la foto ni el resultado en la base. Este módulo reutiliza `black_ai_products` y la matriz técnica existente para mostrar una propuesta principal y hasta dos alternativas verificadas contra ambos ojos y ADD. El vendedor responde uso, prioridad y, en lejos/cerca, preferencia por uno o dos anteojos. Si falta una ficha o una combinación requiere laboratorio, no se declara compatible. La recomendación muestra el código y abre el catálogo de Black AI con búsqueda precargada. No asocia todavía la receta con un cliente o venta. Los criterios y pendientes de administración están en `PRODUCTOS.md`.

La pantalla de permisos del portal aún conserva parte de su estado en el navegador. La Edge Function verifica la sesión de Supabase, pero no aplica una política adicional por rol para este módulo. Antes de dar acceso a personal con distintas atribuciones, conviene trasladar esos permisos al backend.
