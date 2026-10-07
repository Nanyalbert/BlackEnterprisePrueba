# Black OS — Comisiones médicas y entrega digital

## Regla económica

En CRM Oftalmólogos, `prescriptions.amount` representa **Total Receta S/IVA**. Es la base neta de la operación.

Por cada operación:

- Base s/IVA = `amount`.
- IVA = `amount × vat_rate / 100`.
- Monto c/IVA = base + IVA.
- Comisión médica = base s/IVA × porcentaje de comisión.

Los descuentos comerciales ya deben estar reflejados en el importe efectivamente facturado/importado. Los costos financieros del medio de pago, aranceles de tarjeta o financiación **no reducen la base comisionable**.

`vat_rate` queda guardado por receta. El valor por defecto actual es 21%, pero el importador acepta una columna opcional de alícuota IVA.

## Porcentajes históricos

Las reglas viven en `doctor_commission_rules` con `valid_from` / `valid_to`.

Cuando se modifica un porcentaje:
- si se cambia nuevamente el mismo día, se corrige la regla del día;
- si cambia en una fecha posterior, la regla anterior se cierra y se crea una nueva.

La liquidación enviada usa el porcentaje que correspondía a la fecha de cada operación. El snapshot enviado conserva el porcentaje y el importe exactos aunque luego cambie la configuración.

## Entrega por WhatsApp

La entrega principal se realiza desde la tarjeta de comisiones de cada profesional y sucursal.

Flujo:
1. Seleccionar Desde / Hasta.
2. Revisar detalle por paciente.
3. Presionar **Enviar liquidación por WhatsApp**.
4. Confirmar profesional, sucursal, período y destino.
5. La Edge Function `black-doctor-commission-send` vuelve a calcular los datos desde Supabase.
6. Se genera un PDF server-side.
7. Evolution API envía el PDF como documento.
8. Solo después de una respuesta exitosa de Evolution la liquidación queda como **Enviada por WhatsApp**.

El envío no marca la comisión como pagada. **Entrega** y **pago** son estados independientes.

## PDF enviado

Incluye, por operación:

- Fecha
- Paciente
- Monto s/IVA
- IVA
- Monto c/IVA
- Porcentaje de comisión
- Comisión

Resumen:

- operaciones incluidas;
- base total s/IVA;
- IVA incluido;
- total c/IVA;
- total de comisión.

## Auditoría

`doctor_commission_deliveries` conserva el envío y el identificador del proveedor.

`doctor_commission_delivery_lines` conserva un snapshot de cada línea:
- paciente;
- fecha;
- base neta;
- IVA;
- bruto;
- porcentaje;
- comisión.

Las tablas no están disponibles directamente al navegador. La interfaz consulta el estado mediante RPC con permisos.

## Contacto del profesional

Para enviar, el médico debe tener `doctors.phone` cargado.

El CRM sincroniza el campo **Teléfono / WhatsApp** con Supabase. También migra suavemente contactos históricos que todavía estuvieran guardados en el navegador.

Los números argentinos se normalizan al formato internacional utilizado por WhatsApp, incluyendo formatos locales habituales con 0 y 15.

## Papel

La liquidación económica deja de tener al papel como canal principal.

La carta física puede mantenerse únicamente como pieza institucional identificada con el nombre del profesional. El detalle económico y trazable se entrega por WhatsApp.

Los botones Word/PDF del CRM quedan como **respaldo manual**, no como flujo principal de entrega.
