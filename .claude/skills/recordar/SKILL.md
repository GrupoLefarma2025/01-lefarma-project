---
name: recordar
description: Captura fricción operacional o aprendizajes de metodología
options: |
  {descripción de la fricción o aprendizaje}
---

# /recordar

Captura fricción operacional, correcciones a la metodología, o aprendizajes sobre cómo trabajar mejor.

## Uso

```
/recordar El agente confunde 'modulo' con área funcional, debería ser más específico
/recordar Necesitamos campo 'fecha_implementacion' en notas técnicas
```

## Proceso

1. **Crear observación** en ops/observations/:
   ```yaml
   ---
   descripcion: Descripción de la fricción
   category: methodology | process | friction | surprise | quality
   observed: YYYY-MM-DD
   status: pending
   ---
   ```

2. **Clasificar**:
   - `methodology`: Cómo deberíamos trabajar
   - `process`: Problema en el flujo de trabajo
   - `friction`: Fricción específica que ocurrió
   - `surprise`: Comportamiento inesperado
   - `quality`: Problema de calidad detectado

3. **Contexto**:
   - Añade suficiente contexto para que /revisar lo entienda
   - Referencia notas o archivos involucrados

## Rule Zero

**Cuando corrijas al agente, captúralo.**

Mal:
```
Usuario: No, eso no es correcto.
Agente: Lo siento, lo corrijo.
(fin)
```

Bien:
```
Usuario: No, eso no es correcto.
Agente: Lo siento. /recordar Cuando el usuario dice X, interpretar como Y no como Z
```

Esto permite que el sistema evolucione y no repita errores.

## Handoff

Cuando observations > 10:
```
/revisar para analizar patrones y proponer cambios
```
