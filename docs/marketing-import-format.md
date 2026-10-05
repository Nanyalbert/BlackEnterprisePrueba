# Black OS · Marketing — formato de importación

Marketing usa IDs estables para que una segunda importación actualice o reconozca registros existentes sin crear copias. La interfaz siempre muestra una previsualización antes de aplicar cambios.

## JSON

Puede ser un array de contenidos o un objeto con `content_items`. Campos principales admitidos:

```json
{
  "schema_version": "manual-import-v1",
  "source": {"name": "Plan de noviembre", "version": "1"},
  "content_items": [
    {
      "stable_id": "NOV-001",
      "title": "Ejemplo",
      "content_type_id": "commercial",
      "theme_id": "clip_on",
      "format_id": "reel_video",
      "objective": "Consultas",
      "branch_id": "zona-norte",
      "responsible": "Leandro",
      "brief": "Qué queremos contar y por qué.",
      "hook": "Gancho inicial",
      "development": "Desarrollo",
      "material": "Planos necesarios",
      "cta": "Consultanos por WhatsApp",
      "channel": "reels_feed",
      "destination": "WhatsApp",
      "publish_date": "2026-11-05",
      "status_id": "idea",
      "ad_decision_id": "conditional"
    }
  ]
}
```

## CSV

La primera fila contiene encabezados. Como mínimo usar `stable_id,title`. Se aceptan las mismas claves del JSON, por ejemplo:

```csv
stable_id,title,content_type_id,theme_id,format_id,objective,branch_id,brief,publish_date,status_id,ad_decision_id
NOV-001,Ejemplo,commercial,clip_on,reel_video,Consultas,zona-norte,Brief de ejemplo,2026-11-05,idea,conditional
```

## Reglas de actualización

- `stable_id` es la identidad canónica y no debe reciclarse para otra idea.
- Reimportar el mismo lote no crea duplicados.
- En una actualización desde el plan canónico, Marketing actualiza el contenido editorial de la fuente pero preserva campos operativos ya trabajados por el equipo: fecha reprogramada, estado, decisión de pauta, responsable, adjuntos y resultados.
- Si el importador detecta un ID repetido dentro del mismo lote o faltan campos mínimos, marca el registro como `review` y no lo aplica automáticamente.
- Archivar no elimina el contenido; puede recuperarse.
- Importar o programar nunca publica contenido ni activa publicidad.

## Fuente canónica inicial

`data/marketing-plan-v10.json.gz` contiene la precarga estructurada del plan v10 del 4 de octubre de 2026: 96 piezas, plantillas de historias, referencias de marcas y notas globales del plan. Se comprime para evitar duplicar cientos de líneas repetitivas de criterios de Meta Ads dentro del bundle estático.
