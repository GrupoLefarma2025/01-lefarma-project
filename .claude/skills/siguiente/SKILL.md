---
name: siguiente
description: Recomienda la siguiente acción basada en estado del vault
---

# /siguiente

Analiza el estado actual del sistema y recomienda qué hacer a continuación.

## Uso

```
/siguiente
```

## Análisis

1. **Cola de procesamiento**:
   - Revisa ops/queue/ para tareas pendientes
   - Prioriza por fecha y dependencias

2. **Mantenimiento necesario**:
   - Notas estado:revisar
   - Notas estado:obsoleta sin actualizar
   - Enlaces rotos detectados
   - Notas huérfanas

3. **Contexto actual**:
   - Lee self/goals.md para saber qué estamos haciendo
   - Sugiere acciones que avancen los goals activos

4. **Reminders vencidos**:
   - Revisa ops/reminders.md para fechas pasadas

## Recomendación

Presenta 3 opciones ordenadas por prioridad:
1. **Crítico**: Bloquea progreso si no se atiende
2. **Importante**: Avanza goals activos
3. **Oportunidad**: Mejora sistema pero no urgente

Ejemplo:
```
Recomendaciones:

1. [CRÍTICO] /actualizar "Decisión de autenticación"
   La nota tiene estado:revisar y los archivos relacionados cambiaron.

2. [IMPORTANTE] /documentar "Patrón de validación en DTOs"
   Estamos trabajando en Catálogos y falta documentar este patrón.

3. [OPORTUNIDAD] /enlazar all
   Hay 5 notas sin conexiones que podrían relacionarse.
```
