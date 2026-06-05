# Plan: Mejorar Tab "Reglas" en WorkflowDiagram

## Problema Actual

- Lista plana de acciones con handlers, sin jerarquía visual
- No se distingue rápidamente qué acciones tienen reglas vs las que no
- No hay descripción de qué hace cada tipo de handler
- SmartAudit ya no existe (eliminar)

## Solución: Mismo patrón que Notificaciones

Cada acción se muestra como una fila con:
- **Orden del paso** (badge circular azul)
- **Nombre del paso**
- **Nombre de la acción** + código
- **Badges** de handlers configurados
- **Botones** editar/eliminar

### Diseño

```
┌─────────────────────────────────────────────────────────────┐
│ [3]  Revisión GAF  -  AUTORIZAR  [APROBAR]                  │
│      [Campos requeridos] [Actualizar campo]                 │
│                                                       [✏️] [🗑️] │
├─────────────────────────────────────────────────────────────┤
│ [3]  Revisión GAF  -  DEVOLVER  [DEVOLVER]                  │
│      Sin reglas configuradas                                │
│                                                       [+ Agregar]│
├─────────────────────────────────────────────────────────────┤
│ [4]  Director  -  AUTORIZAR  [APROBAR]                      │
│      [Documento requerido]                                  │
│                                                       [✏️] [🗑️] │
└─────────────────────────────────────────────────────────────┘
```

### Badges de handlers

| Handler | Badge | Color | Icono |
|---------|-------|-------|-------|
| `RequiredFields` | "Campos requeridos" | Amber | ListChecks |
| `FieldUpdater` | "Actualizar campo" | Blue | PenLine |
| `DocumentRequired` | "Documento requerido" | Purple | FileText |

### Descripciones (tooltip)

```
RequiredFields:   "Obliga al usuario a completar ciertos campos antes de ejecutar la acción"
FieldUpdater:     "Modifica automáticamente un campo de la orden al ejecutar la acción"
DocumentRequired: "Exige adjuntar un documento específico para continuar"
```

## Cambios Necesarios

### Frontend: WorkflowDiagram.tsx

1. **Eliminar SmartAudit** de HANDLER_LABELS y handlerOptions
2. **Crear componente `HandlerBadge`** (similar a los badges de notificaciones)
3. **Refactorizar tab "handlers"** para usar patrón de notificaciones:
   - Lista plana de handlers (no agrupada)
   - Cada fila muestra: orden del paso, nombre paso, nombre acción, badges
   - Botón agregar/editar/eliminar
4. **Agregar descripciones** como tooltip o info icon

### Backend: (sin cambios)

No se necesitan cambios de backend.

## Tareas

| Orden | Tarea | Archivo | Esfuerzo |
|-------|-------|---------|----------|
| 1 | Eliminar SmartAudit y agregar descripciones | WorkflowDiagram.tsx | 5 min |
| 2 | Refactorizar tab handlers al patrón de notificaciones | WorkflowDiagram.tsx | 30 min |
| 3 | Probar visualmente | — | 10 min |

**Tiempo estimado total:** ~45 min

## Resultado Esperado

- Visual consistente con el resto del workflow diagram
- Badges claros de qué reglas tiene cada acción
- Fácil identificar acciones sin reglas
- Descripciones para entender qué hace cada handler

