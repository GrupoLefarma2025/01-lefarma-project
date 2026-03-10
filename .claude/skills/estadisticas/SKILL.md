---
name: estadisticas
description: Muestra métricas y estado del sistema de notas técnicas
---

# /estadisticas

Muestra métricas del sistema de notas técnicas.

## Uso

```
/estadisticas
```

## Métricas

1. **Volumen**:
   - Total notas técnicas
   - Notas por módulo (Catálogos, Auth, etc.)
   - Notas creadas esta semana/mes

2. **Cobertura**:
   - % de notas con archivos_relacionados válidos
   - % de notas con enlaces
   - Notas huérfanas (sin enlaces entrantes)

3. **Estado**:
   - activa: X notas
   - obsoleta: X notas
   - revisar: X notas

4. **Salud**:
   - Enlaces rotos
   - Schema violations
   - Archivos no encontrados

## Visualización

```
Estadísticas del Vault

Volumen:
  Total notas: 23
  Por módulo:
    Catálogos: 8
    Auth: 5
    API: 6
    Frontend: 4

Estado:
  ✅ activa: 20
  ⚠️  revisar: 2
  🗄️ obsoleta: 1

Salud:
  Schema compliance: 95%
  Enlaces válidos: 45/47 (96%)
  Huérfanas: 2 notas

Acción recomendada: /enlazar para conectar notas huérfanas
```
