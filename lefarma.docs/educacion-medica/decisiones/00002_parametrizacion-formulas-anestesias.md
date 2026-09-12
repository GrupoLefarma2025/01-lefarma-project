---
fecha_creacion: 2026-08-22 17:45
fecha_modificacion: 2026-08-22 17:45
resumen: Cambia el cálculo de las 7 anestesias del FOR-002 de columnas PERSISTED a columnas almacenadas calculadas en el backend, con factores configurables por año en la tabla parametros_anestesias.
---

# 00002 — Parametrización de fórmulas de anestesias del FOR-002

## Status

Accepted

## Contexto

ADR-00001 definió `hospital_extension.anestesias_*` como columnas `PERSISTED` calculadas por SQL Server. Al intentar crear la tabla se produjo el error 1759: una columna calculada no puede hacer referencia a otra columna calculada en su definición (`anestesias_generales` dependía de `anestesias_totales`, etc.).

Además, el área solicitó poder ajustar los factores de la fórmula (cirugías por día, días laborables, porcentajes) sin depender de cambios de código y con versionado anual para conservar históricos.

## Decisión

1. Crear la tabla `educacion_medica.parametros_anestesias`, versionada por `anio`, con un renglón por factor configurable.
2. Convertir `hospital_extension.anestesias_*` en columnas normales `DECIMAL(18,2)`.
3. Calcular las anestesias en el backend mediante el helper `AnestesiaCalculator`.
4. Aplicar el cálculo automáticamente al crear o editar una extensión con los parámetros del año en curso.
5. Ofrecer un endpoint `POST /api/educacion-medica/parametros-anestesias/{anio}/recalcular` para recalcular masivamente todas las extensiones cuando los factores cambien.

### Factores configurables

| Clave | Descripción | Valor por defecto |
|---|---|---|
| `factor_cirugias_dia` | Cirugías promedio por día por quirófano | 2.5 |
| `dias_laborables_anio` | Días laborables al año | 250 |
| `pct_generales` | Porcentaje de anestesias generales | 0.30 |
| `pct_regionales` | Porcentaje de anestesias regionales | 0.70 |
| `pct_epidurales` | Porcentaje de epidurales sobre regionales | 0.35 |
| `pct_subdurales` | Porcentaje de subdurales sobre regionales | 0.45 |
| `pct_mixtas_obesos` | Porcentaje de mixtas obesos sobre regionales | 0.02 |
| `pct_mixtas_no_obesos` | Porcentaje de mixtas no obesos sobre regionales | 0.18 |

La estructura de la fórmula se mantiene fija; lo que es configurable son los factores. Si en el futuro se requiere una fórmula completamente libre, se evaluará un motor de expresiones en un ADR posterior.

## Consequences

### Positivas
- Se resuelve el error 1759 de SQL Server.
- Los factores son editables desde la pantalla sin modificar código.
- El versionado por año permite conservar históricos y recalcular sobre cualquier versión.
- El recálculo masivo es explícito (botón) y controlado, no automático ante cada cambio.

### Negativas
- Es necesario ejecutar un recálculo manual después de editar los factores de un año; si se olvida, los hospitales quedan con valores calculados con parámetros anteriores.
- Se agrega una tabla y un servicio más que mantener.
- La fórmula base sigue siendo fija; cambiar su estructura requiere modificar `AnestesiaCalculator`.

### Neutras
- Los valores almacenados son los mismos que con columnas PERSISTED; solo cambia dónde se ejecuta el cálculo.
- La interfaz de usuario del FOR-002 no cambia para el usuario final; solo se añade la pantalla de configuración de factores.

## Anexo — Fuentes

- `0003_20260806-1556_educacion-medica_create-tablas-operacionales.lefarma.sql`: define `parametros_anestesias` y `hospital_extension` con columnas normales.
- `Lefarma.API/Features/EducacionMedica/Services/AnestesiaCalculator.cs`: contiene la fórmula base.
- `Lefarma.API/Features/EducacionMedica/ParametrosAnestesiasController.cs`: endpoints de consulta, edición y recálculo.
