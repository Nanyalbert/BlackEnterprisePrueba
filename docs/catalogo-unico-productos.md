# Catálogo único de productos: arquitectura y plan de transición

Estado: propuesta de arquitectura basada en el código de `main` revisado el 29-09-2026. Este documento no representa una migración aplicada en Supabase.

## Decisión

Mover la administración funcional a **Administración → Productos**. `black_ai_products` sigue siendo la identidad única de cada artículo/SKU y conserva el vínculo con SINERGIA y su precio. **Recetas** y **Black AI / WhatsApp** son consumidores del mismo catálogo. El administrador define datos técnicos y comerciales; la IA interpreta la consulta y redacta dentro de esos límites, pero no inventa compatibilidades, precios, disponibilidad ni prioridades.

La ficha debe distinguir:

| Capa | Dueño y datos | Uso |
| --- | --- | --- |
| Identidad y precio | Importación SINERGIA: ID externo estable, SKU, nombre, precio, vigencia, estado | Cotización y búsqueda en el sistema |
| Clasificación | Administrador: tipo de cristal, diseño, material, índice, tratamientos, modalidad | Filtrado estructurado |
| Compatibilidad | Laboratorio + administrador: esfera/cilindro/ADD, ambos ojos, pasos, matriz, excepciones, fuente y fecha | Elegibilidad verificable; una ficha incompleta queda pendiente |
| Recomendación | Administrador: segmento, prioridad por caso, perfil de uso, exclusiones, alternativa y motivo aprobado | Orden de ofertas después de la compatibilidad |
| Comunicación | Administrador: descripción breve, beneficios comprobables, límites y mensajes para vendedor/WhatsApp | Explicación contextual sin atribuciones clínicas no verificadas |
| Políticas globales | Administración: estilo de atención, garantías, promociones, financiación, descuentos | Reglas compartidas que no pertenecen a un SKU |

Una variante con otro índice, tratamiento, diseño o rango es otro artículo vendible, vinculado a una misma familia comercial si corresponde. El rango técnico pertenece a la **variante**, no al nombre genérico del producto. Si el laboratorio define excepciones por diámetro, combinación esfera/cilindro u otro parámetro, se exige matriz o validación específica en lugar de ampliar un mínimo/máximo simple.

## Qué encontramos en el código

- `sql/13_black_ai_pricing_engine.sql`, `sql/16_black_ai_quote_engine_foundation.sql` y `sql/17_black_ai_catalog_import.sql` ya construyen `black_ai_products`. No crear un catálogo paralelo.
- `assets/js/black-ai-catalog.js` permite editar algunos rangos, prioridad `metadata.scanner.rank`, familia `metadata.scanner.family` y `metadata.sales_reason`; está incrustado en Black AI. `sql/28_black_ai_scanner_admin.sql` aporta el control de edición, pero su activación y la asignación de una cuenta administradora se deben comprobar en el proyecto Supabase.
- `recetas/recommendations.js` verifica rangos de ambos ojos y después completa tres casilleros. Parte del orden se infiere todavía del nombre del producto y de valores fijos. Tres casilleros no implican tres artículos aptos: una vacante debe decir “sin opción verificada”.
- `supabase/functions/black-ai-case-orchestrator/index.ts` consulta el mismo catálogo, pero su instantánea comercial no lee los rangos de esfera/cilindro/ADD por SKU. La modalidad técnica del caso no prueba por sí sola la elegibilidad de cada artículo. En otra ruta, la preferencia multifocal se lee de `black_ai_knowledge` y el prompt conserva un orden fijo de cuatro diseños. Hay dos decisiones comerciales distintas.
- `black_ai_quote_profiles` ya tiene `option_count` y estrategia, pero no gobierna uniformemente los dos canales. `black_ai_knowledge` y `black_ai_playbook` contienen reglas de lenguaje y contenido; no deben ser una segunda fuente de rangos, precios o elegibilidad.
- `assets/js/black-ai-catalog-import.js` deduce diseño, material, tratamiento, caso y modalidad a partir del texto de SINERGIA. Al reimportar, puede sobrescribir clasificaciones corregidas por el administrador. La clave derivada de descripción y rubros cambia si cambia el nombre; estudiar un ID fuente real antes de asumir estabilidad. La importación debe actualizar los campos de origen y dejar explícitas las diferencias para revisión.
- La migración 28 protege escritura en productos y matriz con un disparador, pero otros conjuntos de reglas aún tienen políticas de escritura amplias para usuarios autenticados. Revisar permisos por área antes de exponer una administración única.

## Motor de recomendación compartido

1. Leer la foto con IA/OCR y mostrar la receta como **borrador**, separando lejos/cerca, OD/OI, esfera, cilindro, eje y ADD. Confirmar valores dudosos con el vendedor; la transposición a cilindro negativo es interna y visible para revisión.
2. Determinar necesidades con preguntas cortas: uso lejos/cerca/ambos, tareas (lectura, computadora, conducción), uno o dos anteojos, preferencias y presupuesto. Esas respuestas ordenan ofertas; no sustituyen la prescripción.
3. Evaluar cada SKU activo contra ambos ojos, ADD cuando corresponda y rango/matriz del laboratorio. Resultado por SKU: `compatible`, `fuera_de_rango` o `pendiente_de_confirmacion`, con motivo. Si faltan datos no clasificar como compatible.
4. Sobre los compatibles, aplicar prioridades **administrables por caso y contexto**, diversidad de familia/diseño y estrategia de gama. Calcular precio vigente y explicación aprobada; registrar qué reglas y versión se usaron.
5. En Recetas mostrar tres posiciones `Premium / Recomendada / Alternativa`, con producto, SKU para encontrarlo en SINERGIA, precio cuando existe, por qué ofrecerlo y posibles límites. Si hay menos de tres productos verificados, mostrar las posiciones vacantes y una acción de consulta al laboratorio: nunca rellenar con uno incompatible.
6. En WhatsApp usar el mismo conjunto elegible. Una consulta general sin receta puede mostrar valores “desde” rotulados como orientativos; una recomendación personalizada requiere receta confirmada. La cantidad y el nivel de detalle del mensaje se definen por canal, sin cambiar la elegibilidad. El envío automático puede requerir aprobación humana según el perfil.

Ejemplo: para una receta de cerca con uso intensivo de computadora, un ocupacional puede subir en prioridad **solo** si su variante cubre ambos ojos y el rango de ADD y la persona acepta esa distancia de trabajo. El motivo aprobado explica el uso próximo/intermedio; no afirma que reemplaza un lente de lejos. El vendedor puede mostrar otras alternativas económicas bajo demanda sin alterar las tres prioritarias.

## Administración propuesta

Entrada principal: **Administración → Productos**; acceso desde Recetas “Editar reglas del catálogo” y desde Black AI “Abrir catálogo”. No duplicar pantallas ni tablas.

- Lista: búsqueda por SKU/nombre, familia, caso, tratamiento y estado; indicadores `Importado`, `Técnica pendiente`, `Listo para recomendar`, `Revisar cambios`.
- Ficha: **Artículo y precio**, **Rango óptico**, **Cuándo ofrecer**, **Argumento aprobado**, **Vista previa e historial**. Cada campo muestra origen, última revisión y responsable. La ayuda diferencia la prioridad comercial de la compatibilidad técnica.
- Vista previa con tres escenarios configurables (lejos, cerca, lejos+cerca) y razones de inclusión/exclusión. Publicar la ficha solo si su rango y contenido fueron revisados; el importador nunca publica automáticamente una corrección técnica.
- Políticas globales y conocimiento de atención siguen en Administración/Black AI como contenidos transversales. Se enlazan a familias/productos por ID cuando corresponda, en vez de repetir descripciones y órdenes en texto libre.

## Orden de implementación

1. **Protección de datos existentes:** inventariar columnas, valores, importaciones y roles reales en Supabase; respaldar catálogo y reglas. Cambiar el importador para preservar decisiones revisadas y exhibir divergencias. Preferir ID estable de SINERGIA si está disponible.
2. **Administración legible:** mover la entrada visible del catálogo a Administración → Productos, reutilizando la tabla; separar las secciones de la ficha y mostrar procedencia/estado. Aplicar y verificar permisos de administrador. Sin cambiar todavía la selección en producción.
3. **Reglas estructuradas:** incorporar por migración versionada la indicación por caso/uso, exclusiones, posición comercial y texto aprobado; mantener la fuente técnica por SKU y su estado de revisión. Evitar depender del nombre o de `metadata.scanner.rank` como único criterio. Migrar gradualmente los campos existentes.
4. **Un motor de elegibilidad:** extraer funciones compartidas y usar el mismo servicio/RPC en Recetas y WhatsApp. Cubrir OD/OI, eje, ADD, cilindro positivo, límites, matriz, stock/rango extendido y fichas incompletas. La interfaz recibe evaluación y razones; no las redefine.
5. **Política por canal y auditoría:** adaptar tres posiciones para el vendedor, mensajes WhatsApp según contexto y aprobación humana; eliminar órdenes comerciales duplicados de prompts/conocimiento. Guardar versión de regla, productos considerados y causa de exclusión. Probar con recetas reales anonimizadas y casos de borde antes de activar la selección nueva.

## Criterios de aceptación

- Una edición aprobada de la ficha se ve en la siguiente evaluación de ambos canales sin copiar datos.
- Reimportar SINERGIA puede renovar nombre/precio de origen, pero no borra rangos, clasificación o argumentos aprobados sin revisión.
- Un SKU fuera de rango o con ficha incompleta no se ofrece como compatible, aunque sea el de mayor precio o prioridad.
- La pantalla del vendedor siempre muestra tres posiciones y distingue vacantes de productos verificados.
- Cada oferta explica el motivo técnico y comercial, precio/estado, SKU y origen de los datos; WhatsApp jamás convierte una cotización orientativa en una promesa de compatibilidad.
- La escritura de fichas y políticas queda limitada a administradores autorizados por controles del servidor y pruebas de permisos.

## Decisiones de negocio que faltan cargar, no inventar

Rangos confirmados por laboratorio para cada variante; catálogo e identificador fuente estable; prioridad por contexto y familia; límites de cada argumento comercial; disponibilidad y precio real; política de envío y aprobación de WhatsApp. El software debe indicar “pendiente” hasta que el administrador los revise.
