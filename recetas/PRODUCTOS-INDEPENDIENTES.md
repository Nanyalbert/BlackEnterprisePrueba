# Black Recetas — catálogo propio (fase 1)
Esta rama separa el inventario de propuestas de Black Recetas de `black_ai_products` (Crystal/Black AI).
No modifica, borra ni sincroniza el catálogo anterior. No cambia recomendaciones de producción aún.

## Objetivo de interacción
Recetas → [Escanear receta] [Productos] [Reglas] (Reglas: fase 2). El vendedor fotografía, verifica la transcripción, y recibe automáticamente tarjetas "Recomendada", "Mayor prestación" y "Alternativa accesible" (nunca prometer un ajuste fabricable sin ficha verificada).
Administrador configura un listado **curado**, no miles de productos.

## Reglas propuestas
1. La IA **solo transcribe**; el motor determinista verifica cada ojo y el tipo de uso.
2. Una graduación con `abs(esfera)` elevada (ej. miopía >5 D) puede subir la prioridad comercial de índices altos, **pero no constituye una indicación universal**. Importan cilindro, meridiano máximo, tamaño y geometría del armazón, disponibilidad del fabricante y preferencias.
3. Presbicia: ofrecer multifocal, dos monofocales y cuando corresponda ocupacional; un ocupacional no sirve para conducir/lejos. Para recomendar hace falta confirmar uso, ADD y modalidad.
4. No duplicar una misma familia comercial en tres tarjetas salvo falta de alternativas.
5. No inventar precios ni stock; mostrar pendientes de consulta cuando falte validación.
6. Las tres tarjetas son orientaciones de presupuestación, no diagnóstico.

## Datos
`sql/29_black_rx_products.sql` crea `black_rx_products`, catálogo independiente protegido por RLS.
La edición se reserva a integrantes de `black_ai_scanner_admins` (requiere ejecutar antes `sql/28_black_ai_scanner_admin.sql`).
Un producto nuevo no está activo ni verificado. Los límites de esfera/cilindro son preliminares: la regla de fabricación debe contemplar también meridiano (`S+C`), diámetro, diseño y excepciones. No hay importación automática de Crystal.

## Criterios para habilitar fase 2
- Confirmar productos, precios, códigos, proveedor y límites certificados.
- Probar signo positivo/negativo, transposición de cilindro, ADD y graduaciones asimétricas con al menos 20 recetas anonimizadas.
- Bloquear recomendación frente a datos ambiguos, falta de validación, combinaciones fuera de rango y error de red.
- Validar admin/no-admin en RLS y permisos de acceso; revisar backups y despliegue.
- Migrar la pantalla a `black_rx_products` solo cuando haya productos activos y verificados; mantener fallback de solo consulta a laboratorio, nunca regresar silenciosamente a Crystal.
