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

La entrega operativa se realiza mediante **WhatsApp directo**, sin Evolution API.

Flujo actual:
1. Seleccionar **Desde / Hasta**.
2. Revisar la comisión del profesional y sucursal.
3. Presionar **Enviar detalle por WhatsApp**.
4. Black OS arma el mensaje usando exclusivamente el período seleccionado.
5. Se abre la conversación del profesional en WhatsApp con el texto precargado.
6. El usuario revisa o edita el mensaje y decide desde qué cuenta de WhatsApp enviarlo.

Black OS **no envía automáticamente** el mensaje y no marca una entrega como confirmada. El número emisor depende de la sesión de WhatsApp que esté abierta en la computadora o dispositivo.

El mensaje incluye:
- período;
- sucursal;
- cantidad de operaciones;
- base total s/IVA;
- IVA;
- total c/IVA;
- total de comisión;
- detalle por paciente con fecha, base, porcentaje y comisión.

Los botones Word/PDF siguen disponibles como respaldo manual. Un enlace directo de WhatsApp puede precargar texto y destinatario, pero no adjuntar automáticamente un PDF.

## Estados de pago

El estado **Pagado / Pendiente** es independiente del envío por WhatsApp. Marcar una comisión como pagada no depende de Evolution ni de un estado de entrega.

## Arquitectura anterior

La Edge Function `black-doctor-commission-send` y las tablas de snapshot de entrega pueden permanecer como infraestructura histórica, pero la interfaz operativa actual no depende de ese circuito para compartir comisiones.

## Contacto del profesional

Para enviar, el médico debe tener `doctors.phone` cargado.

El CRM sincroniza el campo **Teléfono / WhatsApp** con Supabase. También migra suavemente contactos históricos que todavía estuvieran guardados en el navegador.

Los números argentinos se normalizan al formato internacional utilizado por WhatsApp, incluyendo formatos locales habituales con 0 y 15.

## Papel

La liquidación económica deja de tener al papel como canal principal.

La carta física puede mantenerse únicamente como pieza institucional identificada con el nombre del profesional. El detalle económico y trazable se entrega por WhatsApp.

Los botones Word/PDF del CRM quedan como **respaldo manual**, no como flujo principal de entrega.
