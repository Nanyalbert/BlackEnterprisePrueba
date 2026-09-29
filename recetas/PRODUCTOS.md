# Siguiente etapa: catálogo y recomendación asistida

La IA transcribe la receta. El vendedor confirma los valores y responde preguntas de uso. La compatibilidad de cada artículo se decide con reglas administradas por Black Óptica en Supabase; la IA no inventa límites de fabricación, stock ni precios.

## Catálogo administrable

Un administrador carga o importa los artículos desde el catálogo comercial y asigna una regla por diseño, material, índice, tratamiento y proveedor. Campos mínimos:

- `sku` o código exacto para buscar en CRM/administración, nombre comercial, proveedor, estado activo y enlace interno al artículo.
- Diseño: monofocal lejos, monofocal cerca, bifocal, multifocal u ocupacional. Material, índice, tratamientos y disponibilidad por sucursal.
- Por cada ojo: esfera mínima/máxima, cilindro permitido y, cuando aplique, ADD mínima/máxima. Registrar también límites combinados de meridiano `esfera + cilindro`, diámetro y restricciones del laboratorio. Los límites pueden diferir por diseño, índice y proveedor.
- Precio vigente, fecha de actualización y origen de la lista. No presentar precio si la información está vencida.
- Versión y autor de cada regla, con fecha de revisión. El vendedor no puede editarla.

Guardar catálogo y reglas en tablas de Supabase con RLS: lectura para usuarios autenticados de Black OS; escritura solo para administradores verificados en servidor. La pantalla de permisos local del portal no alcanza para proteger estas modificaciones.

## Flujo del vendedor

1. Cargar foto → interpretar con Black AI → corregir y confirmar OD/OI, lejos/cerca, cilindro, eje y ADD.
2. Preguntar por uso principal (conducción, lectura, pantallas, alternancia de distancias), experiencia con multifocales, preferencia por uno o dos anteojos, armazón, tratamiento deseado y presupuesto. El vendedor puede marcar «no sé» sin forzar una respuesta.
3. Elegir categorías pertinentes: solo lejos o solo cerca → monofocal; lejos y cerca → multifocal, bifocal o dos monofocales según respuestas; ocupacional solo si el uso y la receta permiten evaluarlo.
4. Filtrar artículos con reglas deterministas para **ambos ojos**. Si falta un dato requerido o una regla no cubre la receta, mostrar «compatibilidad pendiente de confirmar» y nunca declararlo apto automáticamente.
5. Mostrar motivo, límite aplicado, código/SKU, ubicación en el sistema, precio y disponibilidad vigentes. El vendedor abre la ficha del artículo para cotizar; deja registro de la decisión final.

El resultado debe distinguir **compatible según rangos cargados**, **requiere consulta al laboratorio** y **fuera de rango**. Antes de producción siguen siendo necesarios medidas de montaje y validación profesional.
