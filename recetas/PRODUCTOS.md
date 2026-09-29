# Recomendación asistida y administración del catálogo

La IA transcribe la receta. El vendedor confirma los valores y responde preguntas de uso. La compatibilidad de cada artículo se decide con reglas administradas por Black Óptica en Supabase; la IA no inventa límites de fabricación, stock ni precios. Recetas ya consulta `black_ai_products` y, para familias configuradas, la función `black_ai_resolve_pair_supply_mode` de la matriz `black_ai_optical_matrix`. Verificar en el proyecto real qué migraciones y datos están desplegados.

## Catálogo administrable

Black AI ya dispone de catálogo comercial, campos técnicos (`sphere_min/max`, `cylinder_min/max`, `addition_min/max`, `technical_priority`), `sku` y matriz de algunas familias. Un administrador debe completar y revisar por diseño, material, índice, tratamiento y proveedor:

- `sku` o código exacto para buscar en CRM/administración, nombre comercial, proveedor, estado activo y enlace interno al artículo.
- Diseño: monofocal lejos, monofocal cerca, bifocal, multifocal u ocupacional. Material, índice, tratamientos y disponibilidad por sucursal.
- Por cada ojo: esfera mínima/máxima, cilindro permitido y, cuando aplique, ADD mínima/máxima. Registrar también límites combinados de meridiano `esfera + cilindro`, diámetro y restricciones del laboratorio. Los límites pueden diferir por diseño, índice y proveedor.
- Precio vigente, fecha de actualización y origen de la lista. No presentar precio si la información está vencida.
- Versión y autor de cada regla, con fecha de revisión. El vendedor no puede editarla.

La ficha del catálogo Black AI ofrece al administrador campos de diseño, modalidad, rangos de esfera/cilindro/ADD, familia de matriz, prioridad comercial y motivo aprobado. `metadata.scanner.rank` de 0 a 100 define la prioridad cuando varias fichas son aptas; `metadata.scanner.family` permite agrupar variantes comerciales, y `metadata.sales_reason` se añade a la explicación. El sistema solo selecciona dentro de las fichas técnicamente aptas. La migración `sql/28_black_ai_scanner_admin.sql` crea membresía de administradores y un control de escritura en Supabase para productos y matriz. **Debe ejecutarse y asignar un usuario administrador en el proyecto**; no se despliega al subir GitHub Pages. Mientras tanto, la pantalla nueva queda oculta. La importación y la edición del catálogo después de la migración requieren membresía de administrador.

## Flujo del vendedor

1. Cargar foto → interpretar con Black AI → corregir y confirmar OD/OI, lejos/cerca, cilindro, eje y ADD.
2. Preguntar por uso principal (conducción, lectura, pantallas, alternancia de distancias), experiencia con multifocales, preferencia por uno o dos anteojos, armazón, tratamiento deseado y presupuesto. El vendedor puede marcar «no sé» sin forzar una respuesta.
3. Elegir diseños pertinentes: solo lejos → monofocal; solo cerca → monofocal u ocupacional si el uso es pantallas y tiene ficha compatible; lejos y cerca → multifocal, bifocal o dos monofocales según la preferencia. Un ocupacional no reemplaza un multifocal para todas las distancias.
4. Filtrar artículos con reglas deterministas para **ambos ojos**. Si falta un dato requerido o una regla no cubre la receta, indicar consulta y nunca declararlo apto automáticamente. En cilindro positivo se transpone una copia para cotejar la matriz negativa, preservando la receta original y avisando al vendedor.
5. Mostrar tres lugares premium/recomendado/acceso, con el lugar central destacado. Los tres provienen del extremo superior del catálogo compatible y se diversifican por familia. Lejos: Black Blue 1.67, Super Blue y Blue AR cuando existan y sean aptos. Cerca con pantallas: el ocupacional puede entrar si corresponde al rango; multifocal: diseños premium, intermedio y base. Si hay menos de tres fichas verificadas, el lugar restante dice «pendiente de configuración». El precio, disponibilidad por sucursal, medidas y confirmación final de laboratorio siguen pendientes de integración; no presentar el precio base como cotización.

El resultado debe distinguir **compatible según rangos cargados**, **requiere consulta al laboratorio** y **fuera de rango**. Antes de producción siguen siendo necesarios medidas de montaje y validación profesional.
