# Recetas en Black OS

Este módulo se abre desde `menu.html` y usa la misma sesión de Supabase Auth que Black OS. La foto permanece en el navegador hasta que se pulsa **Interpretar receta**; entonces se envía a `black-recetas-analyze`, una Supabase Edge Function de este mismo proyecto, que usa el secreto `OPENAI_API_KEY` ya empleado por Black AI. No se usa el OCR local: la lectura manuscrita queda como borrador para cotejar con el original. No hay otra clave en GitHub ni se necesita Cloudflare Workers.

## Activación

1. Publicar el frontend de `main` mediante GitHub Pages.
2. Desplegar la función: `supabase functions deploy black-recetas-analyze --project-ref tjetppyqyzgxfhpuyoet` (con JWT habilitado, que es el valor predeterminado). Si `OPENAI_API_KEY` todavía no existe en Edge Function Secrets, configurarlo allí, no en el repositorio.
3. Entrar a Black OS con un usuario de prueba, abrir **Recetas**, cargar una imagen y pulsar **Interpretar con Black AI**. Verificar OD, OI, signos, ejes y lejos/cerca contra el original antes de confirmar.

El frontend no guarda la foto ni el resultado en la base. Este módulo reutiliza `black_ai_products` y la matriz técnica existente para presentar tres lugares: premium, recomendado y acceso. Solamente se completa un lugar con un artículo verificado para ambos ojos y ADD; los vacantes señalan una ficha pendiente. El vendedor responde uso, prioridad y, en lejos/cerca, preferencia de diseño. Otras fichas compatibles quedan en un desplegable. La recomendación muestra el código y abre el catálogo de Black AI con búsqueda precargada. No asocia todavía la receta con un cliente o venta. Los criterios y la administración están en `PRODUCTOS.md`.

El catálogo se abre desde **Black OS → Administración → Catálogo de cristales** o desde el botón **Abrir catálogo** en Recetas. Elegí un artículo y abrí su ficha; allí se encuentra **Ficha del escáner de recetas · administrador**. Para habilitar la edición de rangos y prioridad hay que ejecutar `sql/28_black_ai_scanner_admin.sql` y dar de alta la cuenta administradora indicada en el comentario inicial. El control reside en la base mediante triggers y protege productos y matriz; antes de hacerlo, la ficha muestra el estado «Activación pendiente». La Edge Function verifica la sesión, pero no aplica otra política adicional por rol para interpretar recetas.
