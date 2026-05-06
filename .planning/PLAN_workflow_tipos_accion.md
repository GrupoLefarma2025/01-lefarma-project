# Plan: Migrar tipo_accion a tabla workflow_tipos_accion

## Objetivo
Reemplazar el enum string `tipoAccion` en `workflow_acciones` por una FK a `config.workflow_tipos_accion`, siguiendo el mismo patrón usado para `workflow_estados`.

---

## 1. Backend (C# / .NET 10)

### 1.1 Dominio
- **Nueva entidad**: `WorkflowTipoAccion` (sin atributos `[Table]` ni `[Key]`)
  - `IdTipoAccion` (PK, int)
  - `Codigo` (string, unique, req)
  - `Nombre` (string, req)
  - `Descripcion` (string, nullable)
  - `CambiaEstado` (bool, default true)
  - `Activo` (bool, default true)

- **Modificar `WorkflowAccion`**:
  - Reemplazar `public string TipoAccion { get; set; }` por:
    ```csharp
    public int IdTipoAccion { get; set; }
    public virtual WorkflowTipoAccion? TipoAccion { get; set; }
    ```

### 1.2 Configuración EF Core
- **Nuevo**: `WorkflowTipoAccionConfiguration`
  - Tabla: `config.workflow_tipos_accion`
  - PK: `id_tipo_accion`
  - Índice único: `codigo`
  - Columnas: `codigo` (varchar 50), `nombre` (varchar 100), `cambia_estado` (bit), `activo` (bit)

- **Modificar `WorkflowAccionConfiguration`**:
  - Agregar FK: `workflow_acciones.id_tipo_accion → workflow_tipos_accion.id_tipo_accion`
  - Quitar cualquier constraint/check del string anterior

### 1.3 ApplicationDbContext
- Agregar `DbSet<WorkflowTipoAccion>`
- Verificar que `ApplyConfigurationsFromAssembly` registre `WorkflowTipoAccionConfiguration`

### 1.4 DTOs
- **Nuevo DTO**: `WorkflowTipoAccionResponse`
  - `IdTipoAccion`, `Codigo`, `Nombre`, `CambiaEstado`, `Activo`

- **Modificar `WorkflowAccionResponse`** (o equivalente en DTOs de Workflow):
  - Reemplazar `string TipoAccion` por:
    ```csharp
    public int IdTipoAccion { get; set; }
    public string? TipoAccionCodigo { get; set; }
    public string? TipoAccionNombre { get; set; }
    public bool? TipoAccionCambiaEstado { get; set; }
    ```

### 1.5 Services & Controllers
- **WorkflowsController**: Agregar endpoint `GET /api/config/workflows/tipos-accion`
  - Devuelve lista activa ordenada por `Codigo`
  - Usar `WorkflowTipoAccionResponse`

- **FirmasService / WorkflowEngine** (lógica crítica):
  - Buscar TODO código que haga `switch` o `if` sobre strings como `"APROBACION"`, `"RECHAZO"`, `"RETORNO"`, `"CANCELACION"`
  - Reemplazar comparaciones string por comparación de `IdTipoAccion` o `TipoAccion.Codigo`
  - **Importante**: Usar `TipoAccion.CambiaEstado` para decidir si se actualiza `IdPasoActual`/`IdEstado` de la orden
  - Ejemplo:
    ```csharp
    // Antes
    if (accion.TipoAccion == "RECHAZO") { ... }

    // Después
    if (accion.TipoAccion?.Codigo == "RECHAZAR") { ... }
    // O mejor, por IdTipoAccion si ya se resolvió
    ```

### 1.6 Query Builders
- Revisar queries que filtran por `tipo_accion` string (ej. `Where(a => a.TipoAccion == "APROBACION")`)
- Convertir a joins o a filtros por `IdTipoAccion`

---

## 2. Frontend (React / TypeScript)

### 2.1 Types (`workflow.types.ts`)
- **Nueva interfaz**:
  ```typescript
  export interface WorkflowTipoAccion {
    idTipoAccion: number;
    codigo?: string;
    nombre?: string;
    cambiaEstado: boolean;
    activo: boolean;
  }
  ```

- **Modificar `WorkflowAccion`**:
  ```typescript
  idTipoAccion: number;
  tipoAccionCodigo?: string;
  tipoAccionNombre?: string;
  tipoAccionCambiaEstado?: boolean;
  // eliminar: tipoAccion: string
  ```

### 2.2 API Client
- Agregar función/call `GET /config/workflows/tipos-accion`
- Guardar en estado global o hook local

### 2.3 Componentes afectados
- **`WorkflowDiagram.tsx`**:
  - Dropdown de tipo de acción: usar lista de tipos desde API en lugar de `<Select>` hardcodeado
  - Mostrar `tipoAccionNombre` en el nodo/card de la acción

- **`AutorizacionesOC.tsx`**:
  - Botones de acción disponibles: usar `tipoAccionCodigo` para estilos (success, danger, warning)
  - Lógica de comprobantes: `ENVIAR_TESORERIA` en lugar de string viejo
  - Validaciones: si `tipoAccionCambiaEstado === false`, no requiere avanzar paso

- **`FlujoOrdenPDF.tsx`**:
  - Mapeo de colores por `idTipoAccion` en lugar de string

### 2.4 Estado / Formularios
- En formularios de creación/edición de acciones, el `<Select>` de tipo debe cargar dinámicamente los tipos desde el endpoint
- Validar que `idTipoAccion` sea requerido

---

## 3. Lógica del Motor de Workflow (cambios críticos)

### 3.1 Procesamiento de acciones
El motor debe comportarse diferente según `CambiaEstado`:

| Codigo | CambiaEstado | Comportamiento del motor |
|--------|-------------|--------------------------|
| APROBAR | 1 | Avanza al `idPasoDestino`, actualiza `idEstado` |
| RECHAZAR | 1 | Mueve a paso de rechazo/cancelación, actualiza `idEstado` |
| DEVOLVER | 1 | Retrocede a paso anterior, actualiza `idEstado` |
| CANCELAR | 1 | Mueve a estado cancelado, cierra orden |
| ENVIAR_TESORERIA | 1 | Avanza a paso de tesorería |
| MARCAR_PAGADA | 1 | Actualiza estado a PAGADA |
| CERRAR | 1 | Cierra orden (estado CERRADA) |
| NOTIFICACION | 0 | **Solo** ejecuta handlers/notificaciones, **NO** cambia `idPasoActual` ni `idEstado` |

### 3.2 FirmasService
- Método `FirmarAsync`:
  - Después de ejecutar handlers, verificar `accion.TipoAccion.CambiaEstado`
  - Si `true`: actualizar `orden.IdPasoActual = accion.IdPasoDestino`
  - Si `false`: dejar paso y estado intactos

### 3.3 DashboardService
- KPIs que cuentan órdenes por estado: no se ven afectados directamente
- KPIs de "tiempo en paso": usar `workflow_pasos` + `idEstado` (ya migrado)

---

## 4. Migración de datos (tú la harás aparte)

### 4.1 Script SQL (no incluido en este plan)
Debes crear un script que:
1. Cree `config.workflow_tipos_accion` con los 8 registros
2. Agregue `id_tipo_accion INT` a `config.workflow_acciones`
3. Actualice `id_tipo_accion` basado en el string viejo (mapeo provisto abajo)
4. Elimine la columna string `tipo_accion` (o dejarla temporalmente)
5. Agregue FK + índice

### 4.2 Mapeo de strings viejos → nuevos IDs
```
"APROBACION"  → APROBAR        (cambia_estado=1)
"RECHAZO"     → RECHAZAR       (cambia_estado=1)
"RETORNO"     → DEVOLVER       (cambia_estado=1)
"CANCELACION" → CANCELAR       (cambia_estado=1)
```

⚠️ **Nota**: Si existen acciones con `"ENVIAR_TESORERIA"`, `"MARCAR_PAGADA"`, `"CERRAR"` o `"NOTIFICACION"` ya en la BD como strings, necesitas mapearlos también. Si no existen, solo aparecerán como opciones nuevas disponibles.

---

## 5. Tests a verificar después

- [ ] Crear una orden y ejecutar una acción `APROBAR` → avanza de paso
- [ ] Ejecutar `NOTIFICACION` → orden NO cambia de paso ni de estado
- [ ] Crear workflow con acción `ENVIAR_TESORERIA` → se refleja correctamente en UI
- [ ] Dashboard muestra estados correctamente (ya no depende de tipo_accion)
- [ ] Flujo visual (`FlujoOrdenPDF`) colorea acciones según tipo

---

## 6. Orden recomendado de implementación

1. **Backend**: Entidad + Configuration + DbSet
2. **Backend**: DTOs + Controller endpoint `GET tipos-accion`
3. **Frontend**: Types + API call + carga de tipos en componentes
4. **Backend**: Modificar `WorkflowAccion` entity/DTOs + mapear FK
5. **Backend**: Actualizar motor (FirmasService, WorkflowEngine) para usar `Codigo`/`IdTipoAccion`
6. **Frontend**: Actualizar todos los componentes que usaban string `tipoAccion`
7. **Migrar BD** (tú ejecutas el script)
8. **Probar flujo completo**

---

## Resumen de cambios principales

| Archivo | Cambio |
|---------|--------|
| `Domain/Entities/Config/WorkflowTipoAccion.cs` | NUEVO |
| `Domain/Entities/Config/WorkflowAccion.cs` | `string TipoAccion` → `int IdTipoAccion` + nav |
| `Infrastructure/Data/Configurations/Config/WorkflowTipoAccionConfiguration.cs` | NUEVO |
| `Infrastructure/Data/Configurations/Config/WorkflowAccionConfiguration.cs` | Agregar FK |
| `Infrastructure/Data/ApplicationDbContext.cs` | `DbSet<WorkflowTipoAccion>` |
| `Features/Config/Workflows/DTOs/WorkflowDTOs.cs` | `WorkflowTipoAccionResponse`, mod `WorkflowAccionResponse` |
| `Features/Config/Workflows/WorkflowsController.cs` | `GET tipos-accion` endpoint |
| `Features/OrdenesCompra/Firmas/FirmasService.cs` | Usar `TipoAccion.Codigo` y `CambiaEstado` |
| `Features/Config/Engine/WorkflowEngine.cs` | Usar `IdTipoAccion` en lugar de string |
| `frontend/src/types/workflow.types.ts` | `WorkflowTipoAccion`, mod `WorkflowAccion` |
| `frontend/src/pages/workflows/WorkflowDiagram.tsx` | Select dinámico de tipos |
| `frontend/src/pages/ordenes/AutorizacionesOC.tsx` | Botones por `tipoAccionCodigo` |
| `frontend/src/components/ordenes/FlujoOrdenPDF.tsx` | Colores por `idTipoAccion` |
