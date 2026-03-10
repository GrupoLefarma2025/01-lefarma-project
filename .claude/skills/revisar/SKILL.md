---
name: revisar
description: Revisa observaciones acumuladas y propone ajustes al sistema
---

# /revisar

Revisa observaciones de fricción acumuladas y propone ajustes a la metodología.

## Uso

```
/revisar
/revisar drift  # Enfocado en desviación de metodología
```

## Proceso

1. **Leer observaciones**:
   - Cuenta items en ops/observations/
   - Categoriza: methodology, process, friction, surprise

2. **Detectar patrones**:
   - ¿Hay problemas recurrentes?
   - ¿El agente comete el mismo tipo de error?
   - ¿Algún campo del schema siempre se omite?

3. **Proponer ajustes**:
   - Cambios a CLAUDE.md
   - Ajustes a templates
   - Nuevos campos de schema
   - Cambios de proceso

4. **Documentar**:
   - Crea entrada en ops/methodology/ con propuesta
   - Referencia observaciones que motivan el cambio

## Ejemplo de salida

```
Revisión de Sistema

Observaciones pendientes: 12
  - friction: 5 (principalmente sobre schema)
  - process: 4
  - surprise: 3

Patrón detectado:
  El campo 'decision_alternativa' casi siempre está vacío.
  Sugerencia: Hacerlo opcional o eliminarlo del template.

Propuesta:
  Actualizar templates/nota-tecnica.md para:
  1. Mover decision_alternativa a optional
  2. Añadir campo 'fecha_decision' que se ha usado 3 veces manualmente

¿Aprobar cambios? (sí/no)
```
