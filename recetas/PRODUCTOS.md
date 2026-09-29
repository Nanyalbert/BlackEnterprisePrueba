# Recomendación asistida y administración del catálogo

La IA transcribe la receta. El vendedor confirma los valores y responde preguntas de uso. La compatibilidad de cada artículo se decide con reglas administradas por Black Óptica en Supabase; la IA no inventa límites de fabricación, stock ni precios. Recetas ya consulta `black_ai_products` y, para familias configuradas, la función `black_ai_resolve_pair_supply_mode` de la matriz `black_ai_optical_matrix`. Verificar en el proyecto real qué migraciones y datos están desplegados.

## Catálogo administrable

Black AI ya dispone de catálogo comercial, campos técnicos (`sphere_min/max`, `cylinder_min/max`, `addition_min/max`, `technical_priority`), `sku` y matriz de algunas familias. Un administrador debe completar y revisar por diseño, material, índice, tratamiento y proveedor:

- `sku` o código exacto para buscar en CRM/administración, nombre comercial, proveedor, estado activo y enlace interno al artículo.
- Diseño: monofocal lejos, monofocal cerca, bifocal, multifocal u ocupacional. Material, índice, tratamientos y disponibilidad por sucursal.
- Por cada ojo: esfera mínima/máxima, cilindro permitido y, cuando aplique, ADD mínima/máxima. Registrar también límites combinados de meridiano `esfera + cilindro`, diámetro y restricciones del laboratorio. Los límites pueden diferir por diseño, índice y proveedor.
- Precio vigente, fecha de actualización y origen de la lista. No presentar precio si la información está vencida.
- Versión y autor de cada regla, con fecha de revisión. El vendedor no puede editarla.

Falta una pantalla de edición técnica y comercial que permita definir motivo de venta aprobado (`metadata.sales_reason`), prioridad, límites y código, mostrando fuente y fecha de revisión. Las políticas RLS antiguas de `black_ai_products` y `black_ai_optical_matrix` permiten escritura a cualquier usuario autenticado. Antes de habilitar esa pantalla para vendedores hay que crear un rol de administrador verificable en Supabase y restringir escrituras con RLS. La pantalla de permisos local del portal no alcanza.

## Flujo del vendedor

1. Cargar foto → interpretar con Black AI → corregir y confirmar OD/OI, lejos/cerca, cilindro, eje y ADD.
2. Preguntar por uso principal (conducción, lectura, pantallas, alternancia de distancias), experiencia con multifocales, preferencia por uno o dos anteojos, armazón, tratamiento deseado y presupuesto. El vendedor puede marcar «no sé» sin forzar una respuesta.
3. Elegir diseños pertinentes: solo lejos o solo cerca → monofocal; lejos y cerca → multifocal, bifocal o dos monofocales según respuestas. Ocupacional requiere un flujo específico y no se ofrece automáticamente en esta versión.
4. Filtrar artículos con reglas deterministas para **ambos ojos**. Si falta un dato requerido o una regla no cubre la receta, indicar consulta y nunca declararlo apto automáticamente. En cilindro positivo se transpone una copia para cotejar la matriz negativa, preservando la receta original y avisando al vendedor.
5. Mostrar primero el artículo priorizado, motivo, código/SKU y enlace al catálogo. El precio, disponibilidad por sucursal, medidas y confirmación final de laboratorio siguen pendientes de integración; no presentar el precio base como cotización. Registrar la decisión final en una etapa posterior.

El resultado debe distinguir **compatible según rangos cargados**, **requiere consulta al laboratorio** y **fuera de rango**. Antes de producción siguen siendo necesarios medidas de montaje y validación profesional.
