---
name: actualizar
description: Actualiza notas técnicas para reflejar el estado actual del código
options: |
  {título de nota a actualizar, o 'obsoletas' para todas las marcadas}
---

# /actualizar

Actualiza notas técnicas cuando el código cambia o cuando una nota está marcada como obsoleta/revisar.

## Uso

```
/actualizar "Usamos Entity Framework 6"
/actualizar obsoletas  # Procesa todas las estado:obsoleta
```

## Proceso

1. **Verificar estado**:
   - Lee archivos_relacionados
   - Comprueba si los archivos existen
   - Identifica qué cambió

2. **Actualizar contenido**:
   - Si la decisión sigue vigente: actualiza detalles
   - Si fue reemplazada: documenta la nueva aproximación
   - Si ya no aplica: mantén como obsoleta con explicación

3. **Actualizar schema**:
   - Cambia `estado`: activa | obsoleta | revisar
   - Actualiza `archivos_relacionados` si cambiaron rutas
   - Añade fecha de revisión

4. **Propagación**:
   - Notifica notas relacionadas si hay cambios importantes
   - Actualiza mapas de módulo si el cambio es estructural

## Quality Gates

- [ ] archivos_relacionados existen o están marcados como eliminados
- [ ] estado refleja la realidad del código
- [ ] Contenido actualizado o claramente marcado como histórico

## Handoff

Después de /actualizar:
```
/validar para confirmar integridad post-actualización
```
