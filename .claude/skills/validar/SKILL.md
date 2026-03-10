---
name: validar
description: Valida notas contra schema y verifica integridad de enlaces
options: |
  [ruta específica, o vacío para validar todo]
---

# /validar

Valida que las notas técnicas cumplan con el schema y que los enlaces sean correctos.

## Uso

```
/validar
/validar notas-tecnicas/auth/
```

## Proceso

1. **Validación de schema**:
   - Todas las notas tienen `descripción`
   - Todas tienen `estado` (activa|obsoleta|revisar)
   - Todas tienen `modulo` válido
   - Todas tienen `temas` con al menos un enlace

2. **Validación de archivos**:
   - `archivos_relacionados` existen en el filesystem
   - Rutas son relativas al proyecto

3. **Validación de enlaces**:
   - Wiki links `[[título]]` resuelven a archivos existentes
   - No hay enlaces rotos

4. **Detección de huérfanos**:
   - Notas sin enlaces entrantes
   - MOCs sin notas

## Reporte

Genera reporte en `ops/health/` con:
- % cumplimiento schema
- Lista de enlaces rotos
- Lista de notas huérfanas
- Archivos no encontrados

## Handoff

Si se encuentran problemas:
```
/actualizar para corregir notas obsoletas
```
