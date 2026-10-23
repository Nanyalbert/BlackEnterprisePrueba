# Auditoría de Comisiones — Black OS (23/10/2026)

## Alcance revisado
- `assets/js/comisiones-mensuales.js`: carga de Excel, validaciones, cruce por número de venta, cálculos, resumen, CSV.
- `assets/js/comisiones-unificadas.js`: autenticación, permisos, revisión de excepciones, importación, informes, historial y cambios.
- `assets/js/comisiones-tabs.js`, `comisiones-mensuales.html` y acceso desde `menu.html`.
- Funciones SQL: `hr_commissions_import`, `hr_commissions_save`, `hr_commissions_list`, `hr_commissions_review_update`.

## Datos de prueba — septiembre de 2026
Archivos: CuboVentas Seprimebre 2026(1).xlsx, CuboCobros seprimebre 2026(1).xlsx y CuboRecetas Septiembre 2026(1).xlsx.

- 622 filas de CuboVentas, 198 cobros, 395 filas de CuboRecetas.
- 198/198 cobros con referencia de venta en CuboVentas.
- 35 líneas con base negativa; 31 con base entre $0,00 y $0,90.
- 4 cobros negativos (devoluciones), que no deben generar comisiones positivas.
- 621 líneas de ventas con fecha informada dentro de septiembre de 2026.
- En el ejemplo Castillo Salvador, un descuento de -$57.851,24 y dos productos positivos producen base neta $53.223,14; se calcula sobre el cobro neto, no sobre la suma sin descuentos.

## Controles comprobados
- Un cobro negativo, una venta no encontrada y una línea con precio simbólico no generan comisión automática.
- Los descuentos negativos legítimos reducen la base y no anulan por sí mismos una venta positiva.
- Los artículos excluidos se filtran en la aprobación manual y las líneas sin descripción requieren identificación verificada.
- Las aprobaciones manuales se muestran separadas de la conciliación automática.
- El guardado comprueba que cada comisión coincide con la base multiplicada por la tasa.
- La confirmación de importación muestra importes automáticos, manuales y total, y conserva el detalle de aprobaciones dentro del snapshot del lote.
- La base de datos exige permiso de gestión, valida período y utiliza huella de archivos para evitar importar dos veces el mismo lote.

## Pruebas repetibles
Ejecutar desde la raíz del repositorio:
```bash
node --test tests/commissions-regression.test.cjs
```
Los cinco escenarios verificados: descuento negativo integrado en venta positiva, artículo a costo cero, devolución negativa, precio $0,90 y venta inexistente.

## Precauciones antes de liquidar
1. Seleccionar el período correspondiente a los **Cobros** importados y confirmar manualmente ese alcance. El archivo utilizado no tiene fecha del cobro; la fecha de la venta no equivale a fecha de cobro.
2. Revisar y resolver explícitamente todas las observaciones relevantes: ventas negativas, precios simbólicos, recetas múltiples, artículos de Ministerio y vendedores sin equivalencia.
3. Revisar **Desglose de comisiones** y **Ver qué operaciones se agregaron manualmente** por vendedor.
4. Confirmar que informe individual y resumen tengan el mismo total y que la ventana de importación muestre ese mismo monto.
5. Las importaciones crean registros **pendientes**, no acreditan pago; no registrar ni comunicar pago efectivo antes de comprobar importes.

## Límites de esta auditoría
Se revisó código fuente, esquema SQL, datos locales y pruebas de regresión con simulación del navegador. No se pudo ejecutar el flujo autenticado final en la sesión real del usuario ni confirmar el despliegue de GitHub Pages mediante un navegador conectado. Por tanto, el proceso de pago efectivo no queda certificado de punta a punta.
