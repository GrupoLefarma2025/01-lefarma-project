# Plan: Agregar fechas de ciclo de vida + Enum de estados a `OrdenCompra`

---

## Fase 0: Enum de estados — 1 archivo

**`Shared/Constants/WorkflowEstadoCodigo.cs`** (nuevo)
```csharp
namespace Lefarma.API.Shared.Constants;

public static class WorkflowEstadoCodigo
{
    public const string CREADA = "CREADA";
    public const string REVISION = "REVISION";
    public const string APROBACION = "APROBACION";  // FechaSolicitud: cuando el creador envia a flujo
    public const string REVISION_DIRECTOR = "REVISION_DIRECTOR";
    public const string PAGADA = "PAGADA";
    public const string CERRADA = "CERRADA";
    public const string CANCELADA = "CANCELADA";
    public const string RECHAZADA = "RECHAZADA";
}
```

**Reemplazar strings sueltos** en:
- `DashboardService.cs` — `GetValueOrDefault("CREADA")` → `GetValueOrDefault(WorkflowEstadoCodigo.CREADA)`
- `FirmasService.cs` — `GetValueOrDefault("RECHAZADA")` → `GetValueOrDefault(WorkflowEstadoCodigo.RECHAZADA)`
- `OrdenCompraService.cs` — `GetValueOrDefault("CANCELADA")` → `GetValueOrDefault(WorkflowEstadoCodigo.CANCELADA)`
- `OrdenCompraService.GetAllAsync` — IDs fijos 1, 7, 9 → usar `GetValueOrDefault(...)` con codigos

---

## Fase 1: DB — 1 archivo

**`021_agregar_fechas_orden.sql`**
```sql
-- FechaSolicitud se vuelve nullable (se setea cuando el creador envia al flujo)
ALTER TABLE operaciones.ordenes_compra ALTER COLUMN fecha_solicitud DATETIME NULL;
-- Nuevas columnas
ALTER TABLE operaciones.ordenes_compra ADD fecha_autorizacion DATETIME NULL;  -- director
ALTER TABLE operaciones.ordenes_compra ADD fecha_pago DATETIME NULL;
ALTER TABLE operaciones.ordenes_compra ADD fecha_cierre DATETIME NULL;
ALTER TABLE operaciones.ordenes_compra ADD fecha_rechazo DATETIME NULL;
ALTER TABLE operaciones.ordenes_compra ADD fecha_cancelacion DATETIME NULL;
-- Insertar codigo APROBACION si no existe en workflow_estados
IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = 'APROBACION')
    INSERT INTO config.workflow_estados (codigo, nombre, activo) VALUES ('APROBACION', 'Aprobacion', 1);
```

---

## Fase 2: Entity — 1 archivo

**`OrdenCompra.cs`**
```csharp
// Cambiar FechaSolicitud a nullable
public DateTime? FechaSolicitud { get; set; }  // antes NOT NULL

// Nuevas
public DateTime? FechaAutorizacion { get; set; }
public DateTime? FechaPago { get; set; }
public DateTime? FechaCierre { get; set; }
public DateTime? FechaRechazo { get; set; }
public DateTime? FechaCancelacion { get; set; }
```

---

## Fase 3: Config — 1 archivo

**`OrdenCompraConfiguration.cs`**
```csharp
builder.Property(o => o.FechaSolicitud).HasColumnName("fecha_solicitud").IsRequired(false);
builder.Property(o => o.FechaAutorizacion).HasColumnName("fecha_autorizacion");
builder.Property(o => o.FechaPago).HasColumnName("fecha_pago");
builder.Property(o => o.FechaCierre).HasColumnName("fecha_cierre");
builder.Property(o => o.FechaRechazo).HasColumnName("fecha_rechazo");
builder.Property(o => o.FechaCancelacion).HasColumnName("fecha_cancelacion");
```

---

## Fase 4: DTO + Mapper — 2 archivos

**`OrdenCompraDTOs.cs`** — `OrdenCompraResponse`
```csharp
public DateTime? FechaSolicitud { get; set; }      // ahora nullable
public DateTime? FechaAutorizacion { get; set; }
public DateTime? FechaPago { get; set; }
public DateTime? FechaCierre { get; set; }
public DateTime? FechaRechazo { get; set; }
public DateTime? FechaCancelacion { get; set; }
```

**`OrdenCompraService.cs`** — `ToResponse`
```csharp
FechaSolicitud = o.FechaSolicitud,
FechaAutorizacion = o.FechaAutorizacion,
FechaPago = o.FechaPago,
FechaCierre = o.FechaCierre,
FechaRechazo = o.FechaRechazo,
FechaCancelacion = o.FechaCancelacion,
```

---

## Fase 5: Logica — 2 archivos

**`OrdenCompraService.CreateAsync`** — quitar `FechaSolicitud = DateTime.UtcNow`

**`FirmasService.FirmarAsync`** — despues del engine:
```csharp
var idAprobacion = estados.GetValueOrDefault(WorkflowEstadoCodigo.APROBACION);
var idRevisionDirector = estados.GetValueOrDefault(WorkflowEstadoCodigo.REVISION_DIRECTOR);
var idPagada = estados.GetValueOrDefault(WorkflowEstadoCodigo.PAGADA);
var idCerrada = estados.GetValueOrDefault(WorkflowEstadoCodigo.CERRADA);
var idRechazada = estados.GetValueOrDefault(WorkflowEstadoCodigo.RECHAZADA);
var idCancelada = estados.GetValueOrDefault(WorkflowEstadoCodigo.CANCELADA);

if (nuevoIdEstado == idAprobacion)       orden.FechaSolicitud = DateTime.UtcNow;
if (nuevoIdEstado == idRevisionDirector) orden.FechaAutorizacion = DateTime.UtcNow;
if (nuevoIdEstado == idPagada)           orden.FechaPago = DateTime.UtcNow;
if (nuevoIdEstado == idCerrada)          orden.FechaCierre = DateTime.UtcNow;
if (nuevoIdEstado == idRechazada)        orden.FechaRechazo = DateTime.UtcNow;
if (nuevoIdEstado == idCancelada)        orden.FechaCancelacion = DateTime.UtcNow;
```

Eliminar el bloque viejo `if (nuevoIdEstado == 7) orden.FechaAutorizacion = ...`

---

## Fase 6: Frontend — 2 archivos

**`ordenCompra.types.ts`**
```typescript
fechaSolicitud?: string | null;       // ahora nullable
fechaAutorizacion?: string | null;
fechaPago?: string | null;
fechaCierre?: string | null;
fechaRechazo?: string | null;
fechaCancelacion?: string | null;
```

**`AutorizacionesOC.tsx`** — columnas opcionales

---

## Total: ~10 archivos, ~60 lineas

| Fase | Descripcion | Archivos |
|------|-------------|----------|
| 0 | Enum WorkflowEstadoCodigo | 1 nuevo |
| 1 | DB migration | 1 |
| 2 | Entity | 1 |
| 3 | Config EF | 1 |
| 4 | DTO + Mapper | 2 |
| 5 | Logica (CreateAsync, FirmarAsync) | 2 |
| 6 | Frontend | 2 |
