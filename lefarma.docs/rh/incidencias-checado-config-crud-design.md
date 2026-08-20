# Diseño: CRUD de Configuración de Descuentos por Incidencias de Checado

## Resumen
Pantalla de catálogo en `rh/catalogos` para administrar las reglas de `rh.incidencias_checado_config`. Permite crear, editar y activar/desactivar reglas que determinan cuándo una incidencia de checado genera descuento por acumulación.

## Restricciones
- Visible solo para usuarios con permiso `incidencias_checado.crear`.
- No hay borrado físico; las reglas se desactivan con el campo `activo`.
- Los campos `tipo_incidencia` y `periodo` son selects con valores cerrados.

## Backend

### Controller
`Features/Rh/IncidenciasChecado/IncidenciasChecadoConfigController.cs`

| Método | Endpoint | Descripción | Permiso |
|--------|----------|-------------|---------|
| GET | `/rh/incidencias-checado-config` | Lista todas las reglas | incidencias_checado.crear |
| GET | `/rh/incidencias-checado-config/{id}` | Obtiene una regla por id | incidencias_checado.crear |
| POST | `/rh/incidencias-checado-config` | Crea una regla | incidencias_checado.crear |
| PUT | `/rh/incidencias-checado-config/{id}` | Actualiza una regla, incluyendo `activo` | incidencias_checado.crear |

### Service
`Features/Rh/IncidenciasChecado/IncidenciaChecadoConfigAdminService.cs`
- `GetAllAsync()`
- `GetByIdAsync(id)`
- `CreateAsync(request)`
- `UpdateAsync(id, request)`

### DTOs
- `IncidenciaChecadoConfigResponse`
- `CreateIncidenciaChecadoConfigRequest`
- `UpdateIncidenciaChecadoConfigRequest`

Validaciones:
- `nombre`: requerido, máx 100.
- `descripcion`: requerido, máx 500.
- `tipoIncidencia`: requerido, valores permitidos.
- `minutosMin` / `minutosMax`: opcionales; si ambos tienen valor, `min <= max`.
- `cantidadAcumulada`: requerido, ≥ 1.
- `periodo`: requerido, valores permitidos.
- `prioridad`: ≥ 0.

## Frontend

### Página
`src/apps/rh/pages/catalogos/IncidenciasChecadoConfigList.tsx`

### Ruta
`/rh/catalogos/incidencias-checado-config`

### Menú
Nuevo ítem bajo `rh/catalogos`, visible con `PermissionElement require={['incidencias_checado.crear']}`.

### API
Nuevo `incidenciaChecadoConfigApi` en `src/apps/rh/services/rh.api.ts`:
- `getAll()`
- `getById(id)`
- `create(payload)`
- `update(id, payload)`

### Tipos
Agregar en `src/types/solicitudPersonal.types.ts`:
- `IncidenciaChecadoConfigResponse`
- `CreateIncidenciaChecadoConfigRequest`
- `UpdateIncidenciaChecadoConfigRequest`

### Formulario
Campos:
- `nombre` * (texto)
- `descripcion` * (texto)
- `tipoIncidencia` * (select)
- `minutosMin` (número, opcional)
- `minutosMax` (número, opcional)
- `cantidadAcumulada` * (número)
- `periodo` * (select)
- `prioridad` (número)
- `activo` (checkbox)

Valores de selects:
- `tipoIncidencia`: `TARDANZA_ENTRADA`, `TARDANZA_SALIDA`, `OMISION_ENTRADA`, `OMISION_SALIDA`, `SALIDA_ANTICIPADA`
- `periodo`: `semana`, `quincena`, `mes`

### Tabla
Columnas:
- Nombre
- Tipo de incidencia
- Rango de minutos
- Cantidad acumulada
- Periodo
- Prioridad
- Estado (Activo/Inactivo)
- Acciones (Editar)

La activación/desactivación se hace editando la regla y cambiando el campo `activo`.
