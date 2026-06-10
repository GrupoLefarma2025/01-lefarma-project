# Plan v4: Generalización del Workflow Engine — SolicitudPersonal

## Estado Actual del Proyecto

Este plan se enfoca en **completar la generalización** iniciada en el proyecto. Refactor del engine, entidades, handlers y `WorkflowBitacora` ya están implementados.

### ✅ Ya implementado

| Componente | Archivo | Estado |
|---|---|---|
| `CodigoProceso` (constantes) | `Shared/Constants/CodigoProceso.cs` | ✅ Con `ORDEN_COMPRA` y `SOLICITUD_PERSONAL` |
| `IWorkflowEntity` interfaz | `Domain/Interfaces/Config/IWorkflowEntity.cs` | ✅ |
| `OrdenCompra : IWorkflowEntity` | `Domain/Entities/Operaciones/OrdenCompra.cs` | ✅ |
| `SolicitudPersonal : IWorkflowEntity` | `Domain/Entities/Rh/SolicitudPersonal.cs` | ✅ (con `IWorkflowEntity` ya aplicado) |
| `TipoSolicitud` con flags | `Domain/Entities/Rh/TipoSolicitud.cs` | ✅ |
| `CategoriaSolicitud` enum | `Domain/Entities/Rh/CategoriaSolicitud.cs` | ✅ |
| `SolicitudesPersonalConfiguration` | `Infrastructure/Data/Configurations/Rh/SolicitudesPersonalConfiguration.cs` | ✅ (schema `rh.solicitudes_personal`) |
| `DbSet<SolicitudPersonal>` | `ApplicationDbContext.cs:61` | ✅ |
| `IWorkflowActionHandler.TiposEntidadCompatibles` | `Features/OrdenesCompra/Firmas/Handlers/IWorkflowActionHandler.cs` | ✅ (convención `"ALL"`) |
| `FieldWorkflowHandler` con reflection | `Features/.../FieldWorkflowHandler.cs` | ✅ |
| `AlertaWorkflowHandler` | `Features/.../AlertaWorkflowHandler.cs` | ✅ |
| `DocumentWorkflowHandler` con `IdEntidad` | `Features/.../DocumentWorkflowHandler.cs` | ✅ |
| `ProviderAuthorizationWorkflowHandler` con cast | `Features/.../ProviderAuthorizationWorkflowHandler.cs` | ✅ |
| `WorkflowHandlerContext` polimórfico | `Features/.../WorkflowHandlerContext.cs` | ✅ |
| `WorkflowEngine.GetAccionesDisponiblesAsync` con `tipoEntidad` | `Features/Config/Engine/WorkflowEngine.cs:157` | ✅ |
| `ResolveEntityContextAsync` con switch | `Features/Config/Engine/WorkflowEngine.cs:245` | ✅ (ya incluye `SOLICITUD_PERSONAL`) |
| Validación `TiposEntidadCompatibles` con `"ALL"` | `WorkflowEngine.cs:90` | ✅ |
| `WorkflowBitacora.TipoEntidad + IdEntidad` | `Domain/Entities/Config/WorkflowBitacora.cs` | ✅ |
| `IdOrden` nullable en `WorkflowBitacora` | `Domain/Entities/Config/WorkflowBitacora.cs:5` | ✅ |
| Estructura `Features/Rh/SolicitudesPersonal/{Captura,Firmas}/` | Directorios creados vacíos | ✅ |

### ❌ Pendiente

- Mover handlers a ubicación compartida (decisión arquitectónica)
- NotificationDispatcher genérico
- DTOs, Service, Controller de `SolicitudesPersonal`
- SQL de creación de tabla `rh.solicitudes_personal` y migración de bitácora
- Seed del workflow `SOLICITUD_PERSONAL`

---

## Pregunta Arquitectónica: ¿Dónde van los handlers y el dispatcher?

### Contexto

Los 4 handlers están actualmente en `Features/OrdenesCompra/Firmas/Handlers/`:
```
Features/OrdenesCompra/Firmas/Handlers/
├── FieldWorkflowHandler.cs          (genérico)
├── AlertaWorkflowHandler.cs        (genérico)
├── DocumentWorkflowHandler.cs       (OC-specific)
└── ProviderAuthorizationWorkflowHandler.cs (OC-specific)
```

Esto **no tiene sentido** ahora que 2 son genéricos. Tu pregunta es válida.

### Recomendación: Moverlos a `Features/Config/Workflow/`

**Estructura propuesta:**
```
Features/Config/Workflow/
├── Handlers/                            (NUEVO)
│   ├── IWorkflowActionHandler.cs
│   ├── FieldWorkflowHandler.cs
│   ├── AlertaWorkflowHandler.cs
│   ├── DocumentWorkflowHandler.cs
│   └── ProviderAuthorizationWorkflowHandler.cs
├── WorkflowEngine.cs
├── WorkflowResolver.cs
└── WorkflowAccionesQueryService.cs (si se necesita)
```

**Sobre el NotificationDispatcher:**

El `WorkflowNotificationDispatcher` actual está en `Features/OrdenesCompra/Firmas/`. Esto **sí** se moverá, pero la decisión sobre su estructura depende de si lo generalizamos o no:

| Opción | Ubicación | Razonamiento |
|---|---|---|
| **A. Generalizar (recomendado)** | `Features/Config/Workflow/WorkflowNotificationDispatcher.cs` | Un solo dispatcher que sabe manejar cualquier `WorkflowNotificationContext` |
| **B. Uno por entidad** | `Features/OrdenesCompra/Firmas/` y `Features/Rh/SolicitudesPersonal/Firmas/` | Duplicación masiva (~460 líneas cada uno) |

**Decisión recomendada: A** (generalizar). El plan v3 ya lo tenía así.

**Estructura final después de la mudanza:**
```
Features/Config/Workflow/
├── Engine/
│   ├── WorkflowEngine.cs
│   ├── WorkflowResolver.cs
│   └── WorkflowEntityContext.cs
├── Handlers/                          (MOVIDO desde Features/OrdenesCompra/Firmas/Handlers/)
│   ├── IWorkflowActionHandler.cs
│   ├── FieldWorkflowHandler.cs
│   ├── AlertaWorkflowHandler.cs
│   ├── DocumentWorkflowHandler.cs
│   └── ProviderAuthorizationWorkflowHandler.cs
├── Notification/
│   ├── IWorkflowNotificationDispatcher.cs
│   ├── WorkflowNotificationDispatcher.cs
│   ├── WorkflowNotificationContext.cs  (DTO polimórfico)
│   └── BuildPartidasTable.cs           (helper para OC, usado por FirmasService)
└── WorkflowAccionesQueryService.cs     (helper polimórfico)
```

> **Nota sobre la mudanza**: hacer esto ANTES de crear el módulo de Solicitudes, para que desde el principio el código quede en su lugar correcto.

---

## FASE A: Reorganización Arquitectónica (Mover archivos)

### A.1 Crear nueva estructura de carpetas

```bash
mkdir lefarma.backend/src/Lefarma.API/Features/Config/Workflow/Handlers
mkdir lefarma.backend/src/Lefarma.API/Features/Config/Workflow/Notification
```

### A.2 Mover los 4 handlers + interfaz

**Mover** (cortar y pegar, o `git mv`):

| Origen | Destino |
|---|---|
| `Features/OrdenesCompra/Firmas/Handlers/IWorkflowActionHandler.cs` | `Features/Config/Workflow/Handlers/IWorkflowActionHandler.cs` |
| `Features/OrdenesCompra/Firmas/Handlers/FieldWorkflowHandler.cs` | `Features/Config/Workflow/Handlers/FieldWorkflowHandler.cs` |
| `Features/OrdenesCompra/Firmas/Handlers/AlertaWorkflowHandler.cs` | `Features/Config/Workflow/Handlers/AlertaWorkflowHandler.cs` |
| `Features/OrdenesCompra/Firmas/Handlers/DocumentWorkflowHandler.cs` | `Features/Config/Workflow/Handlers/DocumentWorkflowHandler.cs` |
| `Features/OrdenesCompra/Firmas/Handlers/ProviderAuthorizationWorkflowHandler.cs` | `Features/Config/Workflow/Handlers/ProviderAuthorizationWorkflowHandler.cs` |

### A.3 Actualizar namespaces

En cada uno de los 5 archivos, cambiar:

```csharp
// ANTES
namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;

// DESPUÉS
namespace Lefarma.API.Features.Config.Workflow.Handlers;
```

### A.4 Mover `WorkflowHandlerContext.cs`

**Mover**:
```
Features/OrdenesCompra/Firmas/Handlers/WorkflowHandlerContext.cs
→
Features/Config/Workflow/Handlers/WorkflowHandlerContext.cs
```

Cambiar namespace a `Lefarma.API.Features.Config.Workflow.Handlers`.

### A.5 Actualizar `using` en archivos que referencian los handlers

**Archivos a buscar y actualizar** (grep para `Lefarma.API.Features.OrdenesCompra.Firmas.Handlers`):
- `Features/OrdenesCompra/Firmas/FirmasService.cs` — múltiples referencias
- `Features/Config/Engine/WorkflowEngine.cs` — referencia a la interfaz y contexto
- Cualquier otro que use los handlers

Reemplazar:
```csharp
using Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;
// ↓
using Lefarma.API.Features.Config.Workflow.Handlers;
```

### A.6 Verificar que el proyecto compila

```bash
dotnet build
```

Si hay errores, típicamente son `using` faltantes o referencias circulares.

---

## FASE B: Refactor del NotificationDispatcher

### Decisión Arquitectónica: Mejorar `WorkflowCanalTemplate` en vez de pasar `WorkflowNotificationContext`

**Tu idea es mejor que el plan original.** Después de analizarlo:

**Por qué `WorkflowNotificationContext` no es ideal:**
- Es un DTO pesado que cada service tiene que construir manualmente
- Mezcla datos del template (`TipoProceso`, `NombreProceso`) con datos runtime (`Folio`, `Total`)
- La mitad de los campos son configurables (deberían estar en BD, no en código)
- Acopla el dispatcher al contexto (no podría usarse en escenarios donde no se construya el contexto)

**Tu idea de mejorar `WorkflowCanalTemplate` es más limpia porque:**
- La BD ya tiene la columna `codigo_proceso` en `workflows` (con unique index) — ya es la llave de ruteo
- Los templates ya son globales por canal (`codigo_canal`) — agregar `codigo_proceso` los hace específicos
- El branding (`NombreProceso`, `TipoProceso`, URL) **es data de configuración**, no del runtime
- `WorkflowNotificationContext` se vuelve opcional/superfluo — se puede mantener para casos avanzados

**Resultado**: el dispatcher queda más simple, los datos configurables viven en BD, y `WorkflowNotificationContext` se reduce a lo mínimo (o se elimina).

---

### B.1 Mejorar entidad `WorkflowCanalTemplate`

**Archivo**: `Domain/Entities/Config/WorkflowCanalTemplate.cs`

```csharp
namespace Lefarma.API.Domain.Entities.Config;

public class WorkflowCanalTemplate
{
    public int IdTemplate { get; set; }
    
    /// <summary>
    /// Vincula el template a un codigo_proceso específico (ej: 'ORDEN_COMPRA', 'SOLICITUD_PERSONAL').
    /// NULL = template genérico (fallback para cualquier proceso).
    /// </summary>
    public string? CodigoProceso { get; set; }
    
    public string CodigoCanal { get; set; } = null!; // 'email', 'in_app', 'whatsapp', 'telegram'
    public string Nombre { get; set; } = null!;
    
    /// <summary>
    /// Subheader del email (reemplaza el hardcoded "Sistema de Autorizaciones de Órdenes de Compra").
    /// </summary>
    public string? Subtitulo { get; set; }
    
    /// <summary>
    /// Texto del botón CTA (default: "Ver en el Sistema").
    /// </summary>
    public string? TextoBoton { get; set; }
    
    /// <summary>
    /// Path relativo al frontend (ej: "/autorizaciones?idOrden={IdEntidad}").
    /// Se interpola con {{IdEntidad}} y {{Folio}}.
    /// </summary>
    public string? UrlEntidadTemplate { get; set; }
    
    public string LayoutHtml { get; set; } = null!;
    public bool Activo { get; set; } = true;
    public DateTime FechaModificacion { get; set; } = DateTime.UtcNow;
}
```

**Cambios clave:**
- `+ CodigoProceso` (string nullable) — vincula template a proceso específico
- `+ Subtitulo` — reemplaza "Sistema de Autorizaciones de..." hardcoded
- `+ TextoBoton` — personalizable
- `+ UrlEntidadTemplate` — ruta al frontend con placeholders

**Nota**: el unique constraint actual `UX_workflow_canal_templates_canal UNIQUE (codigo_canal)` debe cambiar a:
```sql
UNIQUE (codigo_canal, codigo_proceso) -- donde codigo_proceso puede ser NULL
```

---

### B.2 Migración SQL — `028_workflow_canal_templates_per_proceso.sql`

**Archivo**: `lefarma.database/028_workflow_canal_templates_per_proceso.sql`

```sql
USE Lefarma;
GO

-- 1. Agregar columnas nuevas
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('[config].[workflow_canal_templates]') 
               AND name = 'codigo_proceso')
BEGIN
    ALTER TABLE config.workflow_canal_templates 
    ADD codigo_proceso VARCHAR(50) NULL,
        subtitulo NVARCHAR(200) NULL,
        texto_boton NVARCHAR(100) NULL,
        url_entidad_template NVARCHAR(500) NULL;
    PRINT 'Columnas nuevas agregadas a workflow_canal_templates';
END
GO

-- 2. Backfill: los templates existentes son para OC
UPDATE config.workflow_canal_templates
SET codigo_proceso = 'ORDEN_COMPRA',
    subtitulo = 'Sistema de Autorizaciones de Ordenes de Compra',
    texto_boton = 'Ver Orden en el Sistema',
    url_entidad_template = '/autorizaciones?idOrden={IdEntidad}'
WHERE codigo_proceso IS NULL;
GO

-- 3. Cambiar unique constraint: ahora (canal, proceso) debe ser único
-- Primero eliminar el antiguo
IF EXISTS (SELECT * FROM sys.indexes 
           WHERE name = 'UX_workflow_canal_templates_canal' 
           AND object_id = OBJECT_ID('[config].[workflow_canal_templates]'))
BEGIN
    ALTER TABLE config.workflow_canal_templates 
    DROP CONSTRAINT UX_workflow_canal_templates_canal;
    PRINT 'Constraint antiguo eliminado';
END
GO

-- Crear nuevo constraint que permite NULL en codigo_proceso
IF NOT EXISTS (SELECT * FROM sys.indexes 
               WHERE name = 'UX_workflow_canal_templates_canal_proceso' 
               AND object_id = OBJECT_ID('[config].[workflow_canal_templates]'))
BEGIN
    CREATE UNIQUE INDEX UX_workflow_canal_templates_canal_proceso
    ON config.workflow_canal_templates (codigo_canal, codigo_proceso)
    WHERE codigo_proceso IS NOT NULL;  -- SQL Server filtered index
    PRINT 'Nuevo unique index creado (permite NULL en codigo_proceso)';
END
GO

-- 4. Índice para lookups por proceso
IF NOT EXISTS (SELECT * FROM sys.indexes 
               WHERE name = 'IX_workflow_canal_templates_proceso' 
               AND object_id = OBJECT_ID('[config].[workflow_canal_templates]'))
BEGIN
    CREATE INDEX IX_workflow_canal_templates_proceso 
    ON config.workflow_canal_templates (codigo_proceso) 
    WHERE codigo_proceso IS NOT NULL;
    PRINT 'Índice por proceso creado';
END
GO

-- 5. Insertar templates para SOLICITUD_PERSONAL
IF NOT EXISTS (SELECT 1 FROM config.workflow_canal_templates 
               WHERE codigo_canal = 'email' AND codigo_proceso = 'SOLICITUD_PERSONAL')
BEGIN
    INSERT INTO config.workflow_canal_templates 
        (codigo_canal, codigo_proceso, nombre, subtitulo, texto_boton, 
         url_entidad_template, layout_html, activo, fecha_modificacion)
    VALUES
    ('email', 'SOLICITUD_PERSONAL', 'Email - Solicitud de Personal',
     'Sistema de Gestión de Solicitudes de Personal',
     'Ver Solicitud en el Sistema',
     '/solicitudes-personal/{IdEntidad}',
     (SELECT layout_html FROM config.workflow_canal_templates 
      WHERE codigo_canal = 'email' AND codigo_proceso = 'ORDEN_COMPRA'),
     1, GETUTCDATE()),
    
    ('in_app', 'SOLICITUD_PERSONAL', 'In-App - Solicitud de Personal',
     NULL, NULL, '/solicitudes-personal/{IdEntidad}',
     '{{Contenido}}', 1, GETUTCDATE());
    
    PRINT 'Templates para SOLICITUD_PERSONAL insertados';
END
GO

PRINT 'Migración 028 completada exitosamente.';
GO
```

---

### B.3 Actualizar `WorkflowCanalTemplateConfiguration`

**Archivo**: `Infrastructure/Data/Configurations/Config/WorkflowCanalTemplateConfiguration.cs`

```csharp
builder.Property(x => x.CodigoProceso).HasColumnName("codigo_proceso").HasMaxLength(50).IsRequired(false);
builder.Property(x => x.Subtitulo).HasColumnName("subtitulo").HasMaxLength(200).IsRequired(false);
builder.Property(x => x.TextoBoton).HasColumnName("texto_boton").HasMaxLength(100).IsRequired(false);
builder.Property(x => x.UrlEntidadTemplate).HasColumnName("url_entidad_template").HasMaxLength(500).IsRequired(false);

// Cambiar el índice
builder.HasIndex(x => new { x.CodigoCanal, x.CodigoProceso })
    .HasDatabaseName("UX_workflow_canal_templates_canal_proceso")
    .HasFilter("[codigo_proceso] IS NOT NULL");
```

---

### B.4 Refactorizar `IWorkflowNotificationDispatcher` para usar contexto mínimo

**Archivo**: `Features/Config/Workflows/Notification/IWorkflowNotificationDispatcher.cs`

```csharp
using Lefarma.API.Domain.Entities.Config;

namespace Lefarma.API.Features.Config.Workflows.Notification;

public interface IWorkflowNotificationDispatcher
{
    /// <summary>
    /// Despacha la notificación configurada para la acción ejecutada.
    /// </summary>
    /// <param name="notificacion">Plantilla resuelta por ResolveWorkflowNotification.</param>
    /// <param name="tipoEntidad">Código del proceso (ej: "ORDEN_COMPRA", "SOLICITUD_PERSONAL").</param>
    /// <param name="idEntidad">ID de la entidad (IdOrden, IdSolicitud, etc.).</param>
    /// <param name="folio">Folio legible (ej: "OC-2026-00001").</param>
    /// <param name="idUsuarioCreador">Creador de la entidad (para notificar al siguiente).</param>
    /// <param name="variablesExtra">Variables adicionales del contexto (Folio, Total, Proveedor, etc.).</param>
    /// <param name="idPasoDestino">Nuevo paso al que pasó la entidad.</param>
    /// <param name="idUsuarioActual">Usuario que ejecutó la acción.</param>
    /// <param name="comentario">Comentario capturado en el paso.</param>
    /// <param name="contenidoAdicionalHtml">HTML extra (ej: tabla de partidas de OC).</param>
    Task DispatchAsync(
        WorkflowNotificacion? notificacion,
        string tipoEntidad,
        int idEntidad,
        string folio,
        int idUsuarioCreador,
        Dictionary<string, string>? variablesExtra,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        string? contenidoAdicionalHtml = null,
        CancellationToken ct = default);
}
```

**Cambio clave**: en lugar de `OrdenCompra orden`, se pasa lo mínimo: `tipoEntidad`, `idEntidad`, `folio`, `idUsuarioCreador`. El branding (subtítulo, botón, URL) se resuelve desde `WorkflowCanalTemplate` por `codigo_proceso`.

---

### B.5 Refactorizar `WorkflowNotificationDispatcher` — QUITAR referencias a `OrdenCompra`

**Archivo**: `Features/Config/Workflows/Notification/WorkflowNotificationDispatcher.cs`

**Cambios línea por línea**:

| Línea actual | Cambio |
|---|---|
| 2 | ELIMINAR `using Lefarma.API.Domain.Entities.Operaciones;` |
| 34-40 | Nueva firma (ver B.4) |
| 71 | `ResolveRecipientsAsync(notificacion, orden, ...)` → `ResolveRecipientsAsync(notificacion, tipoEntidad, idEntidad, idUsuarioCreador, ...)` |
| 79 | `ResolveNamesAsync(orden.IdUsuarioCreador, ...)` → `ResolveNamesAsync(idUsuarioCreador, ...)` |
| 93-95 | `var urlOrden = ...` → `var urlEntidad = BuildUrlEntidad(tipoEntidad, idEntidad, folio, variablesExtra, ctx);` |
| 97-120 | `contextoTemplate` ahora se construye desde `variablesExtra` + variables del sistema (NombreCreador, NombreSiguiente) + `{{UrlEntidad}}` y `{{Subtitulo}}` desde el template |
| 134, 153, 173 | `$"Orden de Compra {orden.Folio}"` → `await BuildAsuntoPorDefectoAsync(tipoEntidad, folio, ctx)` |
| 191 | `orden.Folio` → `folio` |
| 197-200 | Parámetros del método helper |
| 234 | `b.IdOrden == orden.IdOrden` → `b.TipoEntidad == tipoEntidad && b.IdEntidad == idEntidad` |
| 312-324 | `ApplyCanalTemplateAsync` ahora busca por `(codigo_canal, codigo_proceso)` y pasa el `subtitulo` y `texto_boton` al HTML |
| 326-371 | **MOVER** `BuildPartidasTable` a `FirmasService` |
| 373-460 | `BuildEmailHtmlFallback` ahora recibe `subtitulo`, `textoBoton` y los usa en el HTML |

**Métodos privados a refactorizar — USAR CACHÉ LOCAL para evitar doble query al mismo template**:

⚠️ **Por qué importa**: el dispatcher necesita el template del canal `email` dos veces en la misma invocación:
1. Para resolver la URL del botón CTA (`{{UrlEntidad}}`)
2. Para envolver el cuerpo en `layout_html` (vía `ApplyCanalTemplateAsync`)

Si cada llamada hace su propio `FirstOrDefaultAsync`, **se duplica la query a `workflow_canal_templates` por cada notificación enviada**. La solución es un `Dictionary<string, WorkflowCanalTemplate?>` local + una función lazy `GetTemplateAsync(codigoCanal)` que cachea el resultado (incluso si es `null`).

```csharp
// === DENTRO de DispatchAsync, justo después de cargar tipoNotif ===
// Cache de templates por codigo_canal (compartido entre url-entidad y apply-template)
var templatesPorCanal = new Dictionary<string, WorkflowCanalTemplate?>();

// Lazy lookup: query una sola vez por canal, cachea el resultado
async Task<WorkflowCanalTemplate?> GetTemplateAsync(string codigoCanal)
{
    if (templatesPorCanal.TryGetValue(codigoCanal, out var cached))
        return cached;

    var template = await _context.WorkflowCanalTemplates
        .FirstOrDefaultAsync(
            t => t.CodigoCanal == codigoCanal
              && t.CodigoProceso == tipoEntidad
              && t.Activo,
            ct);

    templatesPorCanal[codigoCanal] = template;  // cachea incluso null
    return template;
}
```

**Construcción del `contextoTemplate` (dentro de `DispatchAsync`)**:

```csharp
// Resolver el template del canal 'email' UNA sola vez (queda cacheado)
var templateEmail = await GetTemplateAsync("email");

// Construir URL del botón CTA desde la UrlEntidadTemplate del template
var urlPath = (templateEmail?.UrlEntidadTemplate ?? $"/workflow/entidad/{idEntidad}")
    .Replace("{IdEntidad}", idEntidad.ToString())
    .Replace("{Folio}", folio);
var urlEntidad = string.IsNullOrEmpty(_frontendBaseUrl)
    ? urlPath
    : $"{_frontendBaseUrl}{urlPath}";

var contextoTemplate = variablesExtra ?? new();
contextoTemplate["Folio"] = folio;
contextoTemplate["UrlEntidad"] = urlEntidad;          // {{UrlEntidad}} en template
contextoTemplate["UrlOrden"] = urlEntidad;            // alias legacy (OC usaba {{UrlOrden}})
contextoTemplate["Subtitulo"] = templateEmail?.Subtitulo ?? "Sistema de Autorizaciones";
contextoTemplate["TextoBoton"] = templateEmail?.TextoBoton ?? "Ver en el Sistema";
contextoTemplate["ColorTema"] = tipoNotif?.ColorTema ?? "#0f2744";
contextoTemplate["ColorClaro"] = tipoNotif?.ColorClaro ?? "#e8f0fe";
contextoTemplate["Icono"] = tipoNotif?.Icono ?? "🔔";
contextoTemplate["NombreCreador"] = nombreCreador;
contextoTemplate["NombreSiguiente"] = nombreSiguiente;
contextoTemplate["NombreAnterior"] = nombreActual;
contextoTemplate["Usuario"] = nombreActual;
contextoTemplate["Accion"] = nombreAccion;
contextoTemplate["Comentario"] = comentario ?? "";
// Asunto y ContenidoAdicional se asignan más adelante
if (!string.IsNullOrEmpty(contenidoAdicionalHtml))
    contextoTemplate["ContenidoAdicional"] = contenidoAdicionalHtml;
```

**`ApplyCanalTemplateAsync` refactorizado — recibe la función `getTemplate` para reusar el caché**:

```csharp
private async Task<string> ApplyCanalTemplateAsync(
    string codigoCanal,
    string contenido,
    Dictionary<string, string> ctx,
    Func<string, Task<WorkflowCanalTemplate?>> getTemplate,
    CancellationToken ct)
{
    var template = await getTemplate(codigoCanal);  // ← usa el caché local
    var layoutHtml = template?.LayoutHtml;

    if (string.IsNullOrEmpty(layoutHtml))
    {
        // Fallback: usar subtítulo/texto del template (si está en ctx) o defaults
        return BuildEmailHtmlFallback(
            contenido,
            ctx.GetValueOrDefault("Asunto", ""),
            ctx.GetValueOrDefault("Folio", ""),
            ctx.GetValueOrDefault("UrlEntidad", ""),
            ctx.GetValueOrDefault("Subtitulo", "Sistema de Autorizaciones"),
            ctx.GetValueOrDefault("TextoBoton", "Ver en el Sistema"));
    }

    var withContent = layoutHtml.Replace("{{Contenido}}", contenido, StringComparison.OrdinalIgnoreCase);
    return Interpolate(withContent, ctx);
}
```

**Llamada actualizada en `DispatchAsync`** (línea ~158):

```csharp
// ANTES (con query duplicada):
var emailHtml = await ApplyCanalTemplateAsync(tipoEntidad, "email", cuerpoEmail, contextoTemplate, ct);

// DESPUÉS (reusa caché):
var emailHtml = await ApplyCanalTemplateAsync("email", cuerpoEmail, contextoTemplate, GetTemplateAsync, ct);
```

**`BuildAsuntoPorDefecto` — sin cambios, ya está correcto** (líneas 418-427 del repo actual):

```csharp
private string BuildAsuntoPorDefecto(string tipoEntidad, string folio)
{
    var tipoLegible = tipoEntidad switch
    {
        CodigoProceso.ORDEN_COMPRA => "Orden de Compra",
        CodigoProceso.SOLICITUD_PERSONAL => "Solicitud de Personal",
        _ => "Notificación"
    };
    return $"{tipoLegible} {folio}";
}
```

---

### B.5.1 Estado actual del repo (verificado)

Al revisar `WorkflowNotificationDispatcher.cs` (429 líneas) **antes** de aplicar B.5:

| Estado | Detalle |
|---|---|
| ✅ Firma `DispatchAsync` ya migrada | líneas 34-45: usa `tipoEntidad, idEntidad, folio, idUsuarioCreador, variablesExtra, contenidoAdicional` |
| ❌ **Cuerpo de `DispatchAsync` ROTO — no compila** | líneas 98-100 todavía referencian `orden.IdOrden` que ya no existe como parámetro |
| ✅ `ResolveRecipientsAsync` ya migrado | línea 196: nueva firma, línea 238 usa `TipoEntidad/IdEntidad` |
| ✅ `ResolveNamesAsync` ya migrado | línea 255: usa `idCreador` |
| ✅ `ApplyCanalTemplateAsync` ya filtra por `(codigoCanal, codigoProceso)` | línea 318 |
| ❌ `ApplyCanalTemplateAsync` no reusa caché | línea 317: hace su propio `FirstOrDefaultAsync` |
| ❌ `BuildEmailHtmlFallback` con strings hardcodeados | línea 358 "Sistema de Autorizaciones de Órdenes de Compra", línea 387 "Ver Orden en el Sistema", línea 404 "Sistema de Autorizaciones" |
| ❌ Faltan `Subtitulo`/`TextoBoton` en `contextoTemplate` | línea 102-118: el dict no incluye `{{Subtitulo}}` ni `{{TextoBoton}}` |

**Acción**: aplicar B.5 (cuerpo de `DispatchAsync`) + B.5.1 (caché local) + B.6 (`BuildEmailHtmlFallback` parametrizado) **en un solo commit** para volver a compilar.

**`ResolveRecipientsAsync`** — refactorizado:

```csharp
private async Task<List<int>> ResolveRecipientsAsync(
    WorkflowNotificacion notif,
    string tipoEntidad,
    int idEntidad,
    int idUsuarioCreador,
    int idUsuarioActual,
    List<WorkflowParticipante> participantesDestino,
    CancellationToken ct)
{
    var ids = new HashSet<int>();

    if (notif.AvisarAlCreador)
        ids.Add(idUsuarioCreador);

    if (notif.AvisarAlAnterior)
        ids.Add(idUsuarioActual);

    if (notif.AvisarAlSiguiente && participantesDestino.Count > 0)
    {
        // ... igual que antes ...
    }

    if (notif.AvisarAAutorizadoresPrevios)
    {
        var prevApprovers = await _context.WorkflowBitacoras
            .Where(b => b.TipoEntidad == tipoEntidad && b.IdEntidad == idEntidad)
            // ... igual que antes ...
    }

    return [.. ids];
}
```

---

### B.6 `BuildEmailHtmlFallback` — usar subtítulo y texto del template

**Archivo**: `Features/Config/Workflows/Notification/WorkflowNotificationDispatcher.cs`

Reemplazar método `BuildEmailHtmlFallback` (líneas 373-460) por:

```csharp
private static string BuildEmailHtmlFallback(
    string cuerpo, string asunto, string folio, string urlEntidad,
    string subtitulo, string textoBoton)
{
    return $"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>{asunto}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background-color:#f0f2f5;padding:40px 16px">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" role="presentation"
                       style="max-width:600px;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.10)">

                  <!-- Header -->
                  <tr>
                    <td style="background-color:{{ColorTema}};padding:28px 36px">
                      <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">
                        {{Icono}} Grupo Lefarma
                      </p>
                      <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:400">
                        {subtitulo}
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="background-color:#ffffff;padding:0 0 0 4px;border-left:4px solid {{ColorTema}}">
                      <div style="padding:36px 36px 28px;color:#1f2937;font-size:15px;line-height:1.7">
                        {cuerpo}
                      </div>
                      {{{{ContenidoAdicional}}}}
                    </td>
                  </tr>

                  <!-- CTA Button -->
                  <tr>
                    <td style="background-color:#ffffff;padding:0 36px 36px">
                      <a href="{urlEntidad}"
                         style="display:inline-block;background-color:{{ColorTema}};color:#ffffff;text-decoration:none;
                                padding:13px 28px;border-radius:7px;font-size:14px;font-weight:600;
                                letter-spacing:0.2px;border:none">
                        {textoBoton} →
                      </a>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color:#f8f9fa;padding:20px 36px;border-radius:0 0 10px 10px">
                      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;text-align:center">
                        Este mensaje fue generado automáticamente. Por favor no responda a este correo.<br>
                        © Grupo Lefarma
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;
}
```

**Cambios**:
- `Sistema de Autorizaciones de Órdenes de Compra` → `{subtitulo}` (viene del template)
- `Ver Orden en el Sistema` → `{textoBoton}` (viene del template)
- `{{ContenidoAdicional}}` — slot opcional para tablas (ej: partidas)

---

### B.7 Mover `BuildPartidasTable` a `FirmasService`

**Archivo**: `Features/OrdenesCompra/Firmas/FirmasService.cs`

Agregar como método estático al final de la clase:
```csharp
private static string BuildPartidasTable(
    ICollection<OrdenCompraPartida> partidas, string? rowTemplate = null)
{
    // Mover el contenido de WorkflowNotificationDispatcher.BuildPartidasTable sin cambios
}
```

---

### B.8 Actualizar `FirmasService.FirmarAsync` para usar la nueva firma

**Archivo**: `Features/OrdenesCompra/Firmas/FirmasService.cs`

Reemplazar el bloque `Task.Run` (líneas ~225-239) por:

```csharp
var notifSnapshot = notificacionSeleccionada;
var comentarioSnapshot = request.Comentario;
var pasoDestino = resultado.NuevoIdPaso;
int idUsuarioNotif = idUsuario;
int idSolicitudNotif = orden.IdOrden;
int idUsuarioCreadorNotif = orden.IdUsuarioCreador;
string folioNotif = orden.Folio;

_ = Task.Run(async () =>
{
    using var scope = _scopeFactory.CreateScope();
    var dispatcher = scope.ServiceProvider.GetRequiredService<IWorkflowNotificationDispatcher>();
    var ordenRepo = scope.ServiceProvider.GetRequiredService<IOrdenCompraRepository>();
    var ordenFresh = await ordenRepo.GetWithPartidasAsync(idSolicitudNotif);
    if (ordenFresh is null) return;
    
    var variables = new Dictionary<string, string>
    {
        ["Total"] = ordenFresh.Total.ToString("C2"),
        ["Proveedor"] = ordenFresh.Proveedor?.RazonSocial ?? "",
        ["CentroCosto"] = ordenFresh.CentroCosto?.Nombre ?? ordenFresh.IdCentroCosto?.ToString() ?? "",
        ["CuentaContable"] = ordenFresh.CuentaContable?.Cuenta ?? ordenFresh.IdCuentaContable?.ToString() ?? ""
    };
    
    var partidasHtml = BuildPartidasTable(ordenFresh.Partidas);
    
    await dispatcher.DispatchAsync(
        notificacion: notifSnapshot,
        tipoEntidad: CodigoProceso.ORDEN_COMPRA,
        idEntidad: idSolicitudNotif,
        folio: folioNotif,
        idUsuarioCreador: idUsuarioCreadorNotif,
        variablesExtra: variables,
        idPasoDestino: pasoDestino,
        idUsuarioActual: idUsuarioNotif,
        comentario: comentarioSnapshot,
        contenidoAdicionalHtml: partidasHtml);
});
```

---

### B.9 Decisión: `WorkflowNotificationContext` se mantiene pero es opcional

**Tu pregunta "¿para qué se usa?"**: después del refactor, `WorkflowNotificationContext` se vuelve **opcional/redundante** porque:
- El branding se resuelve desde `WorkflowCanalTemplate.CodigoProceso`
- Los datos runtime se pasan por parámetros simples
- Solo `Variables` (Dictionary) sigue siendo útil para datos específicos por entidad (Total, Proveedor para OC; Folio, TipoSolicitud para SolicitudPersonal)

**Recomendación**: **eliminar `WorkflowNotificationContext.cs`** del código. No aporta valor después de la refactorización.

**Razón para mantenerlo** (si decides conservarlo):
- Si en el futuro algún tipo de entidad tiene MUCHAS variables específicas (ej: 15 campos)
- Si necesitas pasar estado computado que el dispatcher no debería resolver

Para SolicitudPersonal, son ~6 variables → no justifica la abstracción.

**Acción recomendada**: 
1. Marcar `WorkflowNotificationContext.cs` como deprecated
2. Eliminarlo en una iteración posterior si no se usa

---

### B.10 Verificar que no hay otros callers del dispatcher

```bash
grep -r "IWorkflowNotificationDispatcher.DispatchAsync" lefarma.backend/
```

Solo `FirmasService.cs` lo llama. El único caller será actualizado en B.8.

_ = Task.Run(async () =>
{
    using var scope = _scopeFactory.CreateScope();
    var dispatcher = scope.ServiceProvider.GetRequiredService<IWorkflowNotificationDispatcher>();
    var ordenRepo = scope.ServiceProvider.GetRequiredService<IOrdenCompraRepository>();
    var ordenFresh = await ordenRepo.GetWithPartidasAsync(ordenId);
    if (ordenFresh is null) return;
    
    // Refrescar variables con datos frescos
    notifContext.Variables["Folio"] = ordenFresh.Folio;
    notifContext.Variables["Total"] = ordenFresh.Total.ToString("C2");
    notifContext.Variables["Proveedor"] = ordenFresh.Proveedor?.RazonSocial ?? "";
    
    await dispatcher.DispatchAsync(notifSnapshot, notifContext, pasoDestino, idUsuario, comentarioSnapshot);
});
```

### B.7 Actualizar `Program.cs` si el namespace de DI cambió

```csharp
// Verificar que el registro de IWorkflowNotificationDispatcher sigue funcionando
// (no debería requerir cambio si se registró por interfaz, no por namespace)
```

---

## FASE C: SQL Migration para Bitácora Polimórfica (verificar)

### C.1 Verificar que la migración SQL está aplicada

Confirmar que el script de migración existe y fue aplicado:

**Archivo esperado**: `lefarma.database/021_workflow_bitacora_polimorfico.sql`

```sql
-- Verificar que las columnas existen
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'workflow_bitacora' 
  AND TABLE_SCHEMA = 'config';

-- Debe incluir: id_orden (nullable), tipo_entidad, entidad_id
```

Si no existe, **crear**:

```sql
USE Lefarma;
GO

-- 1. Agregar columnas nuevas (permiten NULL en transición)
ALTER TABLE config.workflow_bitacora
ADD TipoEntidad VARCHAR(30) NULL,
    EntidadId INT NULL;
GO

-- 2. Backfill registros existentes (todos son OC)
UPDATE config.workflow_bitacora
SET TipoEntidad = 'ORDEN_COMPRA', 
    EntidadId = ISNULL(IdOrden, 0)
WHERE TipoEntidad IS NULL;
GO

-- 3. Hacer NOT NULL
ALTER TABLE config.workflow_bitacora
ALTER COLUMN TipoEntidad VARCHAR(30) NOT NULL;
GO

-- 4. Permitir NULL en IdOrden (para entidades no-OC)
ALTER TABLE config.workflow_bitacora
ALTER COLUMN IdOrden INT NULL;
GO

-- 5. Índice polimórfico
IF NOT EXISTS (SELECT * FROM sys.indexes 
               WHERE name = 'IX_workflow_bitacora_tipo_entidad' 
               AND object_id = OBJECT_ID('[config].[workflow_bitacora]'))
BEGIN
    CREATE INDEX IX_workflow_bitacora_tipo_entidad 
    ON config.workflow_bitacora (TipoEntidad, EntidadId);
    PRINT 'Índice IX_workflow_bitacora_tipo_entidad creado';
END
GO

PRINT 'Migración 021 completada exitosamente.';
GO
```

### C.2 Verificar la EF Configuration de `WorkflowBitacora`

**Archivo**: `Infrastructure/Data/Configurations/Config/WorkflowBitacoraConfiguration.cs`

Debe tener:
```csharp
builder.Property(x => x.IdOrden).HasColumnName("id_orden").IsRequired(false);
builder.Property(x => x.TipoEntidad).HasColumnName("tipo_entidad").HasMaxLength(30).IsRequired();
builder.Property(x => x.EntidadId).HasColumnName("entidad_id").IsRequired();
```

---

## FASE D: Módulo SolicitudPersonal (Backend)

### D.0 Tabla `rh.tipo_solicitud` + DbSet + Configuration (faltaba!)

⚠️ **Gap detectado**: la entidad `TipoSolicitud` existe en C# pero **NO** tiene:
- Tabla SQL en la BD
- `DbSet<TipoSolicitud>` en `ApplicationDbContext`
- Clase `IEntityTypeConfiguration<TipoSolicitud>`

Sin esto, el seed 027 fallaría con "tabla no existe" y EF no podría consultar tipos de solicitud.

---

#### D.0.1 SQL Migration — Crear tabla `rh.tipo_solicitud`

**Archivo**: `lefarma.database/024_tipo_solicitud.sql` (NUEVO)

```sql
USE Lefarma;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'rh')
BEGIN
    EXEC('CREATE SCHEMA rh');
    PRINT 'Esquema [rh] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[rh].[tipo_solicitud]'))
BEGIN
    CREATE TABLE rh.tipo_solicitud
    (
        id_tipo_solicitud              INT IDENTITY(1,1) PRIMARY KEY,
        nombre                         NVARCHAR(100) NOT NULL,
        nombre_normalizado             NVARCHAR(100) NULL,
        descripcion                    NVARCHAR(500) NOT NULL,
        descripcion_normalizada        NVARCHAR(500) NULL,
        clave                          NVARCHAR(50)  NOT NULL UNIQUE,
        categoria                      INT NOT NULL,                      -- CategoriaSolicitud enum (1..4)
        es_incidencia                  BIT NOT NULL DEFAULT 0,
        es_permiso                     BIT NOT NULL DEFAULT 0,
        requiere_reposicion_tiempo     BIT NOT NULL DEFAULT 0,
        requiere_fecha_fin             BIT NOT NULL DEFAULT 0,
        requiere_fecha_regreso         BIT NOT NULL DEFAULT 0,
        requiere_lugar_comision        BIT NOT NULL DEFAULT 0,
        descuenta_nomina               BIT NOT NULL DEFAULT 0,
        descuenta_vacaciones           BIT NOT NULL DEFAULT 0,
        requiere_documentacion         BIT NOT NULL DEFAULT 0,
        requiere_validacion_rh         BIT NOT NULL DEFAULT 1,
        requiere_validacion_jefe_dir   BIT NOT NULL DEFAULT 1,
        requiere_validacion_gerencia   BIT NOT NULL DEFAULT 0,
        requiere_validacion_director   BIT NOT NULL DEFAULT 0,
        activo                         BIT NOT NULL DEFAULT 1,
        fecha_creacion                 DATETIME NOT NULL DEFAULT GETDATE(),
        fecha_modificacion             DATETIME NULL
    );
    PRINT 'Tabla [rh].[tipo_solicitud] creada';

    -- Índice por categoría para combos/filtros
    CREATE INDEX IX_tipo_solicitud_categoria 
        ON rh.tipo_solicitud(categoria) WHERE activo = 1;
    CREATE INDEX IX_tipo_solicitud_clave 
        ON rh.tipo_solicitud(clave);
END
GO

PRINT 'Migración 024 completada.';
GO
```

**Notas de diseño**:
- `categoria` es `INT` (no FK) porque mapea al enum `CategoriaSolicitud` (1=Incidencia, 2=Permiso, 3=Vacaciones, 4=GoceDeSueldo)
- `requiere_validacion_rh` default `1` (todas las solicitudes de personal pasan por RRHH al final)
- `requiere_validacion_jefe_dir` default `1` (todas pasan por jefe inmediato)
- `requiere_validacion_gerencia` y `..._director` default `0` (se activan según el tipo)
- Los `CHECK` constraints no se agregan al INSERT para mantener flexibilidad (p.ej. un Permiso podría tener `es_incidencia=1` en algún caso edge)

---

#### D.0.2 Crear `TipoSolicitudesConfiguration.cs` (Fluent API)

**Archivo NUEVO**: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Rh/TipoSolicitudesConfiguration.cs`

```csharp
using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class TipoSolicitudesConfiguration : IEntityTypeConfiguration<TipoSolicitud>
    {
        public void Configure(EntityTypeBuilder<TipoSolicitud> builder)
        {
            builder.ToTable("tipo_solicitud", "rh");
            builder.HasKey(t => t.IdTipoSolicitud);
            builder.Property(t => t.IdTipoSolicitud).HasColumnName("id_tipo_solicitud").ValueGeneratedOnAdd();
            builder.Property(t => t.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(t => t.NombreNormalizado).HasColumnName("nombre_normalizado").HasMaxLength(100).IsRequired(false);
            builder.Property(t => t.Descripcion).HasColumnName("descripcion").HasMaxLength(500).IsRequired();
            builder.Property(t => t.DescripcionNormalizada).HasColumnName("descripcion_normalizada").HasMaxLength(500).IsRequired(false);
            builder.Property(t => t.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
            builder.Property(t => t.Categoria).HasColumnName("categoria").HasConversion<int>().IsRequired();
            builder.Property(t => t.EsIncidencia).HasColumnName("es_incidencia").HasDefaultValue(false);
            builder.Property(t => t.EsPermiso).HasColumnName("es_permiso").HasDefaultValue(false);
            builder.Property(t => t.RequiereReposicionTiempo).HasColumnName("requiere_reposicion_tiempo").HasDefaultValue(false);
            builder.Property(t => t.RequiereFechaFin).HasColumnName("requiere_fecha_fin").HasDefaultValue(false);
            builder.Property(t => t.RequiereFechaRegreso).HasColumnName("requiere_fecha_regreso").HasDefaultValue(false);
            builder.Property(t => t.RequiereLugarComision).HasColumnName("requiere_lugar_comision").HasDefaultValue(false);
            builder.Property(t => t.DescuentaNomina).HasColumnName("descuenta_nomina").HasDefaultValue(false);
            builder.Property(t => t.DescuentaVacaciones).HasColumnName("descuenta_vacaciones").HasDefaultValue(false);
            builder.Property(t => t.RequiereDocumentacion).HasColumnName("requiere_documentacion").HasDefaultValue(false);
            builder.Property(t => t.RequiereValidacionRH).HasColumnName("requiere_validacion_rh").HasDefaultValue(true);
            builder.Property(t => t.RequiereValidacionJefeDirecto).HasColumnName("requiere_validacion_jefe_dir").HasDefaultValue(true);
            builder.Property(t => t.RequiereValidacionGerencia).HasColumnName("requiere_validacion_gerencia").HasDefaultValue(false);
            builder.Property(t => t.RequiereValidacionDirector).HasColumnName("requiere_validacion_director").HasDefaultValue(false);
            builder.Property(t => t.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(t => t.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(t => t.FechaModificacion).HasColumnName("fecha_modificacion").IsRequired(false);
            
            builder.HasIndex(t => t.Clave).IsUnique();
        }
    }
}
```

---

#### D.0.3 Registrar `DbSet<TipoSolicitud>` en `ApplicationDbContext`

**Archivo**: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`

En la sección "DbSets - Rh" (línea 60-61), agregar:

```csharp
// DbSets - Rh
public DbSet<SolicitudPersonal> SolicitudesPersonal { get; set; }
public DbSet<TipoSolicitud> TiposSolicitud { get; set; }   // ← NUEVO
```

(No se necesita `OnModelCreating` adicional — `ApplyConfigurationsFromAssembly` en línea 122 descubre automáticamente `TipoSolicitudesConfiguration`.)

---

### D.1 SQL Migration — Tabla `rh.solicitudes_personal` (verificar/crear)

**Archivo**: `lefarma.database/025_solicitudes_personal.sql` (NUEVO o verificar si ya existe)

```sql
USE Lefarma;
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'rh')
BEGIN
    EXEC('CREATE SCHEMA rh');
    PRINT 'Esquema [rh] creado';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[rh].[solicitudes_personal]'))
BEGIN
    CREATE TABLE rh.solicitudes_personal (
        id_solicitud INT IDENTITY(1,1) PRIMARY KEY,
        folio NVARCHAR(20) NOT NULL UNIQUE,
        id_empresa INT NOT NULL,
        id_sucursal INT NOT NULL,
        id_area INT NOT NULL,
        id_usuario_creador INT NOT NULL,
        id_estado INT NOT NULL,
        id_workflow INT NOT NULL,
        id_paso_actual INT NULL,
        id_tipo_solicitud INT NOT NULL,
        lugar_comision NVARCHAR(100) NULL,
        motivo NVARCHAR(500) NULL,
        fecha_envio DATETIME NULL,
        fecha_inicio DATETIME NULL,
        fecha_fin DATETIME NULL,
        fecha_reposicion DATETIME NULL,
        dias_solicitados INT NULL,
        fecha_regreso DATETIME NULL,
        fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
        fecha_modificacion DATETIME NULL
    );
    PRINT 'Tabla [rh].[solicitudes_personal] creada';
END
GO

CREATE INDEX IX_solicitudes_personal_id_usuario_creador 
    ON rh.solicitudes_personal(id_usuario_creador);
CREATE INDEX IX_solicitudes_personal_id_estado 
    ON rh.solicitudes_personal(id_estado);
CREATE INDEX IX_solicitudes_personal_id_workflow 
    ON rh.solicitudes_personal(id_workflow);
CREATE INDEX IX_solicitudes_personal_id_tipo_solicitud 
    ON rh.solicitudes_personal(id_tipo_solicitud);
GO

PRINT 'Migración 025 completada.';
GO
```

### D.2 DTOs (NUEVOS)

**Archivo**: `Features/Rh/SolicitudesPersonal/DTOs/SolicitudPersonalDto.cs`

```csharp
namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

public record SolicitudPersonalDto(
    int Id,
    string Folio,
    int IdTipoSolicitud,
    string? TipoSolicitudNombre,
    CategoriaSolicitud Categoria,
    int IdEstado,
    string? Estado,
    int? IdPasoActual,
    string? PasoActual,
    int IdUsuarioCreador,
    string? UsuarioCreador,
    int IdEmpresa,
    int IdSucursal,
    int IdArea,
    string? LugarComision,
    string? Motivo,
    DateTime? FechaEnvio,
    DateTime? FechaInicio,
    DateTime? FechaFin,
    DateTime? FechaReposicion,
    int? DiasSolicitados,
    DateTime? FechaRegreso,
    DateTime FechaCreacion,
    DateTime? FechaModificacion
);
```

**Archivo**: `Features/Rh/SolicitudesPersonal/DTOs/CrearSolicitudPersonalRequest.cs`

```csharp
namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

public record CrearSolicitudPersonalRequest(
    int IdTipoSolicitud,
    int IdEmpresa,
    int IdSucursal,
    int IdArea,
    string? Motivo,
    string? LugarComision,
    DateTime? FechaInicio,
    DateTime? FechaFin,
    int? DiasSolicitados,
    DateTime? FechaRegreso,
    DateTime? FechaReposicion,
    Dictionary<string, object>? DatosAdicionales
);
```

**Archivo**: `Features/Rh/SolicitudesPersonal/DTOs/AccionSolicitudRequest.cs`

```csharp
namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

public record AccionSolicitudRequest(
    int IdAccion,
    string? Comentario,
    Dictionary<string, object>? DatosAdicionales
);
```

### D.3 Service (NUEVO)

**Archivo**: `Features/Rh/SolicitudesPersonal/SolicitudesPersonalService.cs`

```csharp
using ErrorOr;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflow.Notification;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

public class SolicitudesPersonalService
{
    private readonly ApplicationDbContext _context;
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowResolver _resolver;
    private readonly IWorkflowNotificationDispatcher _notifDispatcher;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AsokamDbContext _asokamContext;

    public SolicitudesPersonalService(
        ApplicationDbContext context,
        IWorkflowEngine engine,
        IWorkflowResolver resolver,
        IWorkflowNotificationDispatcher notifDispatcher,
        IHttpContextAccessor httpContextAccessor,
        IServiceScopeFactory scopeFactory,
        AsokamDbContext asokamContext)
    {
        _context = context;
        _engine = engine;
        _resolver = resolver;
        _notifDispatcher = notifDispatcher;
        _httpContextAccessor = httpContextAccessor;
        _scopeFactory = scopeFactory;
        _asokamContext = asokamContext;
    }

    private int CurrentUserId => 
        int.Parse(_httpContextAccessor.HttpContext!.User.FindFirst("IdUsuario")!.Value);

    public async Task<ErrorOr<SolicitudPersonalDto>> CrearAsync(
        CrearSolicitudPersonalRequest request, int idUsuario)
    {
        // 1. Validar tipo de solicitud
        var tipo = await _context.TiposSolicitud
            .FirstOrDefaultAsync(t => t.IdTipoSolicitud == request.IdTipoSolicitud && t.Activo);
        if (tipo is null)
            return CommonErrors.NotFound("TipoSolicitud", request.IdTipoSolicitud.ToString());

        // 2. Resolver workflow para SOLICITUD_PERSONAL
        var workflow = await _resolver.ResolveWorkflowIdAsync(
            CodigoProceso.SOLICITUD_PERSONAL,
            idUsuario,
            request.IdEmpresa,
            request.IdSucursal,
            request.IdArea);
        if (workflow is null)
            return CommonErrors.NotFound("Workflow", CodigoProceso.SOLICITUD_PERSONAL);

        // 3. Validar campos requeridos según flags del tipo
        if (tipo.RequiereFechaFin && !request.FechaFin.HasValue)
            return CommonErrors.Validation("FechaFin", "Este tipo de solicitud requiere fecha fin.");
        if (tipo.RequiereFechaRegreso && !request.FechaRegreso.HasValue)
            return CommonErrors.Validation("FechaRegreso", "Este tipo de solicitud requiere fecha de regreso.");
        if (tipo.RequiereLugarComision && string.IsNullOrWhiteSpace(request.LugarComision))
            return CommonErrors.Validation("LugarComision", "Este tipo de solicitud requiere lugar de comisión.");
        if (tipo.RequiereReposicionTiempo && !request.FechaReposicion.HasValue)
            return CommonErrors.Validation("FechaReposicion", "Este tipo de solicitud requiere fecha de reposición.");

        // 4. Paso inicial
        var pasoInicial = workflow.Pasos.FirstOrDefault(p => p.EsInicio && p.Activo);
        if (pasoInicial is null)
            return CommonErrors.Conflict("Workflow", "El workflow no tiene paso inicial.");

        // 5. Estado inicial
        var estadoInicial = await _context.WorkflowEstados
            .FirstOrDefaultAsync(e => e.Codigo == "CREADA" && e.Activo);
        if (estadoInicial is null)
            return CommonErrors.NotFound("WorkflowEstado", "CREADA");

        // 6. Generar folio
        var folio = await GenerarFolioAsync(tipo);

        // 7. Crear entidad
        var solicitud = new SolicitudPersonal
        {
            Folio = folio,
            IdWorkflow = workflow.IdWorkflow,
            IdPasoActual = pasoInicial.IdPaso,
            IdEstado = estadoInicial.IdEstado,
            IdUsuarioCreador = idUsuario,
            IdTipoSolicitud = request.IdTipoSolicitud,
            IdEmpresa = request.IdEmpresa,
            IdSucursal = request.IdSucursal,
            IdArea = request.IdArea,
            Motivo = request.Motivo,
            LugarComision = request.LugarComision,
            FechaInicio = request.FechaInicio,
            FechaFin = request.FechaFin,
            DiasSolicitados = request.DiasSolicitados,
            FechaRegreso = request.FechaRegreso,
            FechaReposicion = request.FechaReposicion,
            FechaCreacion = DateTime.UtcNow
        };

        _context.SolicitudesPersonal.Add(solicitud);
        await _context.SaveChangesAsync();

        var dto = await MapToDto(solicitud, pasoInicial.NombrePaso, estadoInicial.Codigo, null);
        return dto;
    }

    public async Task<ErrorOr<SolicitudPersonalDto>> GetByIdAsync(int id)
    {
        var s = await _context.SolicitudesPersonal
            .Include(x => x.Estado)
            .Include(x => x.Empresa)
            .Include(x => x.Sucursal)
            .Include(x => x.Area)
            .FirstOrDefaultAsync(x => x.IdSolicitud == id);
        if (s is null)
            return CommonErrors.NotFound("SolicitudPersonal", id.ToString());

        var paso = s.IdPasoActual.HasValue
            ? await _context.WorkflowPasos
                .Where(p => p.IdPaso == s.IdPasoActual.Value)
                .Select(p => p.NombrePaso)
                .FirstOrDefaultAsync()
            : null;

        var usuarioCreador = await _asokamContext.Usuarios
            .Where(u => u.IdUsuario == s.IdUsuarioCreador)
            .Select(u => u.NombreCompleto)
            .FirstOrDefaultAsync();

        return await MapToDto(s, paso, s.Estado?.Codigo, usuarioCreador);
    }

    public async Task<ErrorOr<FirmarResponse>> FirmarAsync(
        int idSolicitud, AccionSolicitudRequest request, int idUsuario)
    {
        var s = await _context.SolicitudesPersonal
            .Include(x => x.Estado)
            .FirstOrDefaultAsync(x => x.IdSolicitud == idSolicitud);
        if (s is null)
            return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

        // Validar estado no terminal
        if (s.Estado?.Codigo is "CERRADA" or "CANCELADA" or "RECHAZADA" or "APROBADA")
            return CommonErrors.Conflict("SolicitudPersonal", 
                $"La solicitud {s.Folio} ya está en estado terminal.");

        // Construir contexto del motor
        var ctx = new WorkflowContext(
            IdWorkflow: s.IdWorkflow,
            IdEntidad: s.IdSolicitud,
            TipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
            Entidad: s,
            IdAccion: request.IdAccion,
            IdUsuario: idUsuario,
            Comentario: request.Comentario,
            DatosAdicionales: request.DatosAdicionales
        );

        var resultado = await _engine.EjecutarAccionAsync(ctx);
        if (!resultado.Exitoso)
            return CommonErrors.Validation("Workflow", resultado.Error ?? "Error en el motor.");

        // Actualizar entidad
        s.IdPasoActual = resultado.NuevoIdPaso;
        if (resultado.NuevoIdEstado.HasValue)
            s.IdEstado = resultado.NuevoIdEstado.Value;

        // Si se ejecutó la acción de ENVÍO, setear FechaEnvio
        var accion = await _context.WorkflowAcciones
            .Include(a => a.TipoAccion)
            .FirstOrDefaultAsync(a => a.IdAccion == request.IdAccion);
        if (accion?.TipoAccion?.Codigo == "ENVIAR" && !s.FechaEnvio.HasValue)
            s.FechaEnvio = DateTime.UtcNow;

        s.FechaModificacion = DateTime.UtcNow;

        // Si llega a estado terminal, marcar fecha_modificacion
        var nuevoEstado = await _context.WorkflowEstados.FindAsync(s.IdEstado);
        if (nuevoEstado?.Codigo is "CERRADA" or "APROBADA" or "RECHAZADA")
            s.FechaModificacion = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Notificación fire-and-forget
        await DispatchNotificacionAsync(s, request.IdAccion, resultado.NuevoIdPaso, request.Comentario, idUsuario);

        return new FirmarResponse
        {
            Exitoso = true,
            Folio = s.Folio,
            NuevoEstado = nuevoEstado?.Codigo
        };
    }

    public async Task<List<SolicitudPersonalDto>> ListarAsync(
        int? idUsuarioCreador, int? idEstado, int? idTipoSolicitud, int? idArea)
    {
        var query = _context.SolicitudesPersonal
            .Include(x => x.Estado)
            .AsQueryable();

        if (idUsuarioCreador.HasValue)
            query = query.Where(x => x.IdUsuarioCreador == idUsuarioCreador.Value);
        if (idEstado.HasValue)
            query = query.Where(x => x.IdEstado == idEstado.Value);
        if (idTipoSolicitud.HasValue)
            query = query.Where(x => x.IdTipoSolicitud == idTipoSolicitud.Value);
        if (idArea.HasValue)
            query = query.Where(x => x.IdArea == idArea.Value);

        var items = await query.OrderByDescending(x => x.FechaCreacion).ToListAsync();
        var result = new List<SolicitudPersonalDto>();
        foreach (var item in items)
        {
            var dto = await MapToDto(item, null, item.Estado?.Codigo, null);
            result.Add(dto);
        }
        return result;
    }

    public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idSolicitud, int idUsuario)
    {
        var s = await _context.SolicitudesPersonal.FindAsync(idSolicitud);
        if (s is null)
            return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

        var acciones = await _engine.GetAccionesDisponiblesAsync(
            s.IdWorkflow, idSolicitud, idUsuario, CodigoProceso.SOLICITUD_PERSONAL);
        return acciones.Select(a => new AccionDisponibleResponse
        {
            IdAccion = a.IdAccion,
            IdTipoAccion = a.IdTipoAccion,
            TipoAccionCodigo = a.TipoAccion?.Codigo,
            TipoAccionNombre = a.TipoAccion?.Nombre
        });
    }

    public async Task<List<WorkflowBitacoraDto>> GetHistorialAsync(int idSolicitud)
    {
        return await _context.WorkflowBitacoras
            .AsNoTracking()
            .Where(b => b.TipoEntidad == CodigoProceso.SOLICITUD_PERSONAL && b.IdEntidad == idSolicitud)
            .OrderByDescending(b => b.FechaEvento)
            .Select(b => new WorkflowBitacoraDto
            {
                IdEvento = b.IdEvento,
                IdPaso = b.IdPaso,
                NombrePaso = b.Paso != null ? b.Paso.NombrePaso : null,
                IdAccion = b.IdAccion,
                NombreAccion = b.Accion != null && b.Accion.TipoAccion != null ? b.Accion.TipoAccion.Nombre : null,
                IdUsuario = b.IdUsuario,
                Comentario = b.Comentario,
                DatosSnapshot = b.DatosSnapshot,
                FechaEvento = b.FechaEvento
            })
            .ToListAsync();
    }

    // --- Métodos privados ---

    private async Task DispatchNotificacionAsync(
        SolicitudPersonal s, int idAccion, int? idPasoDestino, string? comentario, int idUsuario)
    {
        try
        {
            // Cargar workflow con notificaciones
            var workflow = await _context.Workflows
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.Notificaciones)
                            .ThenInclude(n => n.Canales)
                .FirstOrDefaultAsync(w => w.IdWorkflow == s.IdWorkflow);

            if (workflow is null) return;

            var notificacion = workflow.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .Where(a => a.IdAccion == idAccion)
                .SelectMany(a => a.Notificaciones)
                .FirstOrDefault(n => n.Activo && (n.IdPasoDestino == idPasoDestino || n.IdPasoDestino == null));

            if (notificacion is null) return;

            var tipo = await _context.TiposSolicitud.FindAsync(s.IdTipoSolicitud);

            var context = new WorkflowNotificationContext
            {
                TipoEntidad = CodigoProceso.SOLICITUD_PERSONAL,
                TipoProceso = "Solicitud de Personal",
                NombreProceso = "Sistema de Gestión de Solicitudes de Personal",
                IdEntidad = s.IdSolicitud,
                Folio = s.Folio,
                IdUsuarioCreador = s.IdUsuarioCreador,
                UrlEntidad = $"/solicitudes-personal/{s.IdSolicitud}",
                Variables = new Dictionary<string, string>
                {
                    ["Folio"] = s.Folio,
                    ["TipoSolicitud"] = tipo?.Nombre ?? "",
                    ["Categoria"] = tipo?.Categoria.ToString() ?? "",
                    ["Motivo"] = s.Motivo ?? "",
                    ["FechaInicio"] = s.FechaInicio?.ToString("yyyy-MM-dd") ?? "",
                    ["FechaFin"] = s.FechaFin?.ToString("yyyy-MM-dd") ?? "",
                    ["DiasSolicitados"] = s.DiasSolicitados?.ToString() ?? "",
                    ["LugarComision"] = s.LugarComision ?? "",
                    ["ColorTema"] = "#1d3f6e",
                    ["ColorClaro"] = "#e8f0fe",
                    ["Icono"] = "📋"
                },
                TablaHtml = null
            };

            await _notifDispatcher.DispatchAsync(notificacion, context, idPasoDestino, idUsuario, comentario);
        }
        catch (Exception ex)
        {
            // Log silencioso
            Console.WriteLine($"Error dispatching notificación: {ex.Message}");
        }
    }

    private async Task<string> GenerarFolioAsync(TipoSolicitud tipo)
    {
        // Prefijo según categoría
        var prefijo = tipo.Categoria switch
        {
            CategoriaSolicitud.Incidencia => "INC",
            CategoriaSolicitud.Permiso => "PER",
            CategoriaSolicitud.Vacaciones => "VAC",
            CategoriaSolicitud.GoceDeSueldo => "GDS",
            _ => "SOL"
        };

        var year = DateTime.UtcNow.Year;
        var lastNum = await _context.SolicitudesPersonal
            .Where(s => s.Folio.StartsWith($"{prefijo}-{year}-"))
            .OrderByDescending(s => s.IdSolicitud)
            .Select(s => s.Folio)
            .FirstOrDefaultAsync();

        int next = 1;
        if (lastNum != null)
        {
            var parts = lastNum.Split('-');
            if (int.TryParse(parts[^1], out var n)) next = n + 1;
        }
        return $"{prefijo}-{year}-{next:D5}";
    }

    private async Task<SolicitudPersonalDto> MapToDto(
        SolicitudPersonal s, string? paso, string? estado, string? usuario)
    {
        var tipo = await _context.TiposSolicitud.FindAsync(s.IdTipoSolicitud);
        return new SolicitudPersonalDto(
            Id: s.IdSolicitud,
            Folio: s.Folio,
            IdTipoSolicitud: s.IdTipoSolicitud,
            TipoSolicitudNombre: tipo?.Nombre,
            Categoria: tipo?.Categoria ?? CategoriaSolicitud.Permiso,
            IdEstado: s.IdEstado,
            Estado: estado ?? s.Estado?.Codigo,
            IdPasoActual: s.IdPasoActual,
            PasoActual: paso,
            IdUsuarioCreador: s.IdUsuarioCreador,
            UsuarioCreador: usuario,
            IdEmpresa: s.IdEmpresa,
            IdSucursal: s.IdSucursal,
            IdArea: s.IdArea,
            LugarComision: s.LugarComision,
            Motivo: s.Motivo,
            FechaEnvio: s.FechaEnvio,
            FechaInicio: s.FechaInicio,
            FechaFin: s.FechaFin,
            FechaReposicion: s.FechaReposicion,
            DiasSolicitados: s.DiasSolicitados,
            FechaRegreso: s.FechaRegreso,
            FechaCreacion: s.FechaCreacion,
            FechaModificacion: s.FechaModificacion
        );
    }
}
```

**Notas**:
- `FirmarResponse` y `AccionDisponibleResponse` son DTOs de `Features/OrdenesCompra/Firmas` — importar o clonar
- El método `DispatchNotificacionAsync` no usa `Task.Run` porque el dispatcher ya está inyectado como scoped

### D.4 Controller (NUEVO)

**Archivo**: `Features/Rh/SolicitudesPersonal/SolicitudesPersonalController.cs`

```csharp
using ErrorOr;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

[ApiController]
[Route("api/solicitudes-personal")]
[Authorize]
public class SolicitudesPersonalController : ControllerBase
{
    private readonly SolicitudesPersonalService _service;
    public SolicitudesPersonalController(SolicitudesPersonalService service) => _service = service;

    private int CurrentUserId => 
        int.Parse(User.FindFirst("IdUsuario")!.Value);

    [HttpGet]
    public async Task<IActionResult> Listar(
        [FromQuery] int? idUsuarioCreador,
        [FromQuery] int? idEstado,
        [FromQuery] int? idTipoSolicitud,
        [FromQuery] int? idArea)
    {
        var result = await _service.ListarAsync(idUsuarioCreador, idEstado, idTipoSolicitud, idArea);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);
        // Usar el patrón ToActionResult del proyecto
        return result.Match(
            dto => Ok(dto),
            errors => BadRequest(errors));
    }

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearSolicitudPersonalRequest request)
    {
        var result = await _service.CrearAsync(request, CurrentUserId);
        return result.Match(
            dto => CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto),
            errors => BadRequest(errors));
    }

    [HttpPost("{id}/acciones")]
    public async Task<IActionResult> Firmar(int id, [FromBody] AccionSolicitudRequest request)
    {
        var result = await _service.FirmarAsync(id, request, CurrentUserId);
        return result.Match(
            response => Ok(response),
            errors => BadRequest(errors));
    }

    [HttpGet("{id}/acciones-disponibles")]
    public async Task<IActionResult> GetAccionesDisponibles(int id)
    {
        var result = await _service.GetAccionesDisponiblesAsync(id, CurrentUserId);
        return result.Match(
            acciones => Ok(acciones),
            errors => BadRequest(errors));
    }

    [HttpGet("{id}/historial")]
    public async Task<IActionResult> GetHistorial(int id)
    {
        var result = await _service.GetHistorialAsync(id);
        return Ok(result);
    }

    [HttpGet("tipos-solicitud")]
    public async Task<IActionResult> ListarTipos()
    {
        // Endpoint adicional para listar los tipos de solicitud disponibles
        var tipos = await _service.ListarTiposAsync();
        return Ok(tipos);
    }
}
```

**Nota sobre `ToActionResult`**: el proyecto usa un patrón de extensión. Verifica cómo se usa en `OrdenCompraController` o `FirmasController` y reemplaza el `.Match(...)` por ese patrón.

### D.5 Registrar en DI (MODIFICAR)

**Archivo**: `Program.cs`

```csharp
builder.Services.AddScoped<SolicitudesPersonalService>();
```

### D.6 Listar tipos de solicitud (helper en service)

Agregar al `SolicitudesPersonalService`:

```csharp
public async Task<List<TipoSolicitudDto>> ListarTiposAsync()
{
    return await _context.TiposSolicitud
        .Where(t => t.Activo)
        .OrderBy(t => t.Nombre)
        .Select(t => new TipoSolicitudDto
        {
            IdTipoSolicitud = t.IdTipoSolicitud,
            Nombre = t.Nombre,
            Clave = t.Clave,
            Categoria = t.Categoria.ToString(),
            EsIncidencia = t.EsIncidencia,
            EsPermiso = t.EsPermiso,
            RequiereReposicionTiempo = t.RequiereReposicionTiempo,
            RequiereFechaFin = t.RequiereFechaFin,
            RequiereFechaRegreso = t.RequiereFechaRegreso,
            RequiereLugarComision = t.RequiereLugarComision,
            DescuentaNomina = t.DescuentaNomina,
            DescuentaVacaciones = t.DescuentaVacaciones,
            RequiereDocumentacion = t.RequiereDocumentacion,
            RequiereValidacionRH = t.RequiereValidacionRH,
            RequiereValidacionJefeDirecto = t.RequiereValidacionJefeDirecto,
            RequiereValidacionGerencia = t.RequiereValidacionGerencia,
            RequiereValidacionDirector = t.RequiereValidacionDirector
        })
        .ToListAsync();
}
```

Y crear el DTO:

**Archivo**: `Features/Rh/SolicitudesPersonal/DTOs/TipoSolicitudDto.cs`

```csharp
namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

public record TipoSolicitudDto(
    int IdTipoSolicitud,
    string Nombre,
    string Clave,
    string Categoria,
    bool EsIncidencia,
    bool EsPermiso,
    bool RequiereReposicionTiempo,
    bool RequiereFechaFin,
    bool RequiereFechaRegreso,
    bool RequiereLugarComision,
    bool DescuentaNomina,
    bool DescuentaVacaciones,
    bool RequiereDocumentacion,
    bool RequiereValidacionRH,
    bool RequiereValidacionJefeDirecto,
    bool RequiereValidacionGerencia,
    bool RequiereValidacionDirector
);
```

---

## FASE E: Seed del Workflow SOLICITUD_PERSONAL

### E.1 SQL Seed (NUEVO)

**Archivo**: `lefarma.database/026_seed_workflow_solicitud_personal.sql`

```sql
USE Lefarma;
GO

-- 1. Workflow
IF NOT EXISTS (SELECT 1 FROM config.workflows WHERE codigo_proceso = 'SOLICITUD_PERSONAL')
BEGIN
    INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    VALUES (
        'Solicitud de Personal',
        'Workflow para solicitudes de personal (permisos, incidencias, vacaciones)',
        'SOLICITUD_PERSONAL', 1, 1, GETUTCDATE()
    );
    PRINT 'Workflow SOLICITUD_PERSONAL creado';
END
GO

DECLARE @idWorkflow INT = (SELECT id_workflow FROM config.workflows WHERE codigo_proceso = 'SOLICITUD_PERSONAL');

-- 2. Pasos
IF NOT EXISTS (SELECT 1 FROM config.workflow_pasos WHERE id_workflow = @idWorkflow)
BEGIN
    DECLARE @idPaso1 INT, @idPaso2 INT, @idPaso3 INT, @idPaso4 INT;
    
    -- Paso 1: Captura
    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, es_inicio, es_final, activo)
    VALUES (@idWorkflow, 1, 'Captura de Solicitud', 1, 1, 0, 1);
    SET @idPaso1 = SCOPE_IDENTITY();
    
    -- Paso 2: Jefe Inmediato
    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, es_inicio, es_final, activo, requiere_comentario)
    VALUES (@idWorkflow, 2, 'Aprobacion Jefe Inmediato', 2, 0, 0, 1, 1);
    SET @idPaso2 = SCOPE_IDENTITY();
    
    -- Paso 3: Gerencia / Director (si aplica)
    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, es_inicio, es_final, activo, requiere_comentario)
    VALUES (@idWorkflow, 3, 'Aprobacion Gerencia', 2, 0, 0, 1, 1);
    SET @idPaso3 = SCOPE_IDENTITY();
    
    -- Paso 4: RRHH (final)
    INSERT INTO config.workflow_pasos (id_workflow, orden, nombre_paso, id_estado, es_inicio, es_final, activo)
    VALUES (@idWorkflow, 4, 'Validacion RRHH', 5, 0, 1, 1);
    SET @idPaso4 = SCOPE_IDENTITY();
    
    -- Acciones: Aprobar (envía al siguiente paso)
    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, envia_concentrado, activo)
    SELECT @idPaso1, @idPaso2, ta.id_tipo_accion, 0, 1
    FROM config.workflow_tipos_accion ta WHERE ta.codigo = 'ENVIAR';
    
    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, envia_concentrado, activo)
    SELECT @idPaso2, @idPaso3, ta.id_tipo_accion, 0, 1
    FROM config.workflow_tipos_accion ta WHERE ta.codigo = 'APROBAR';
    
    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, envia_concentrado, activo)
    SELECT @idPaso3, @idPaso4, ta.id_tipo_accion, 0, 1
    FROM config.workflow_tipos_accion ta WHERE ta.codigo = 'APROBAR';
    
    -- Acción: Rechazar (regresa a paso 1)
    INSERT INTO config.workflow_acciones (id_paso_origen, id_paso_destino, id_tipo_accion, envia_concentrado, activo)
    SELECT p.id_paso, @idPaso1, ta.id_tipo_accion, 0, 1
    FROM config.workflow_pasos p
    CROSS JOIN config.workflow_tipos_accion ta
    WHERE p.id_workflow = @idWorkflow AND p.es_inicio = 0 AND ta.codigo = 'RECHAZAR';
    
    PRINT 'Pasos y acciones del workflow SOLICITUD_PERSONAL creados';
END
GO

-- 3. Mapping por defecto
IF NOT EXISTS (SELECT 1 FROM config.workflow_mappings WHERE codigo_proceso = 'SOLICITUD_PERSONAL')
BEGIN
    DECLARE @idScopeDefault INT = (SELECT id_scope_type FROM config.workflow_scope_types WHERE codigo = 'DEFAULT');
    DECLARE @idWorkflowSol INT = (SELECT id_workflow FROM config.workflows WHERE codigo_proceso = 'SOLICITUD_PERSONAL');
    
    INSERT INTO config.workflow_mappings (codigo_proceso, id_scope_type, scope_id, id_workflow, prioridad_manual, activo, fecha_creacion)
    VALUES ('SOLICITUD_PERSONAL', @idScopeDefault, NULL, @idWorkflowSol, 100, 1, GETUTCDATE());
    
    PRINT 'Mapping DEFAULT para SOLICITUD_PERSONAL creado';
END
GO

PRINT 'Migración 026 completada exitosamente.';
GO
```

### E.2 Seed de tipos de solicitud base (requerido por D.0)

**Archivo**: `lefarma.database/027_seed_tipos_solicitud.sql`

⚠️ **Prerrequisito**: la tabla `rh.tipo_solicitud` debe existir (creada por migración **024**).

```sql
USE Lefarma;
GO

-- Enum CategoriaSolicitud: Incidencia=1, Permiso=2, Vacaciones=3, GoceDeSueldo=4
-- Cada tipo define sus flags; el servicio valida los campos requeridos al crear la solicitud.

-- 1. PERMISO_PERSONAL — permiso genérico con/sin goce de sueldo
IF NOT EXISTS (SELECT 1 FROM rh.tipo_solicitud WHERE clave = 'PERMISO_PERSONAL')
BEGIN
    INSERT INTO rh.tipo_solicitud
        (nombre, descripcion, clave, categoria, es_permiso,
         requiere_fecha_fin, requiere_fecha_regreso, requiere_lugar_comision,
         descuenta_nomina, descuenta_vacaciones,
         requiere_validacion_rh, requiere_validacion_jefe_dir,
         activo)
    VALUES
        ('Permiso Personal',
         'Permiso para asuntos personales con/sin goce de sueldo',
         'PERMISO_PERSONAL', 2, 1,
         1, 1, 0,        -- requiere fecha_fin y fecha_regreso, NO lugar_comision
         1, 0,            -- descuenta nómina si no es con goce
         1, 1,            -- pasa por RH y jefe directo
         1);
    PRINT 'Tipo PERMISO_PERSONAL insertado';
END
GO

-- 2. INCIDENCIA_FALTA — registro de falta (no requiere aprobación, solo notifica)
IF NOT EXISTS (SELECT 1 FROM rh.tipo_solicitud WHERE clave = 'INCIDENCIA_FALTA')
BEGIN
    INSERT INTO rh.tipo_solicitud
        (nombre, descripcion, clave, categoria, es_incidencia,
         requiere_fecha_fin, requiere_reposicion_tiempo,
         descuenta_nomina, descuenta_vacaciones,
         requiere_validacion_rh, requiere_validacion_jefe_dir,
         activo)
    VALUES
        ('Falta Injustificada',
         'Registro de falta del empleado (para control de asistencia)',
         'INCIDENCIA_FALTA', 1, 1,
         1, 0,             -- requiere fecha_fin (el día de la falta), NO reposición
         0, 0,             -- no descuenta (es solo registro)
         1, 1,             -- notifica a RH y al jefe
         1);
    PRINT 'Tipo INCIDENCIA_FALTA insertado';
END
GO

-- 3. COMISION — viaje a otra sucursal/lugar (subtipo de permiso)
IF NOT EXISTS (SELECT 1 FROM rh.tipo_solicitud WHERE clave = 'COMISION')
BEGIN
    INSERT INTO rh.tipo_solicitud
        (nombre, descripcion, clave, categoria, es_permiso,
         requiere_fecha_fin, requiere_fecha_regreso, requiere_lugar_comision,
         requiere_documentacion,
         requiere_validacion_rh, requiere_validacion_jefe_dir, requiere_validacion_gerencia,
         activo)
    VALUES
        ('Comisión',
         'Comisión del empleado a otra sucursal o lugar de trabajo',
         'COMISION', 2, 1,            -- categoría Permiso
         1, 1, 1,                     -- requiere fecha_fin, fecha_regreso, lugar_comision
         1,                           -- requiere documentación (oficio de comisión)
         1, 1, 1,                     -- pasa por RH + jefe + gerencia
         1);
    PRINT 'Tipo COMISION insertado';
END
GO

PRINT 'Seed 027 (tipos de solicitud) completado.';
GO
```

**Notas del seed**:
- `categoria` para COMISION es **2 (Permiso)**, no 0. La distinción se hace por `requiere_lugar_comision=1`, no por categoría.
- Cada tipo activa distintos flags de validación. `SolicitudesPersonalService` usará estos flags para decidir qué validaciones aplicar al ejecutar acciones.
- `requiere_documentacion` está activo para COMISION porque la comisión requiere un oficio/orden.

---

## FASE F: Verificación

### F.1 Build y tests

```bash
dotnet build lefarma.backend
dotnet test lefarma.backend/tests/Lefarma.UnitTests
```

### F.2 Validación manual

- [ ] El proyecto compila sin errores
- [ ] Las pruebas existentes de OrdenCompra siguen pasando
- [ ] `OrdenCompra` sigue creando, firmando y notificando
- [ ] Endpoint `GET /api/solicitudes-personal` responde
- [ ] Endpoint `POST /api/solicitudes-personal` crea una solicitud
- [ ] Endpoint `POST /api/solicitudes-personal/{id}/acciones` ejecuta una acción
- [ ] El handler `Document` se rechaza en SolicitudPersonal con mensaje claro
- [ ] `WorkflowBitacora` se filtra correctamente por `TipoEntidad`
- [ ] Notificaciones siguen funcionando para OC (el cambio de dispatcher no las rompió)

---

## Resumen de Cambios Restantes

### Nuevos (19 archivos)

| # | Archivo | Propósito |
|---|---|---|
| 1 | `Features/Config/Workflow/Handlers/IWorkflowActionHandler.cs` | Movido desde `OrdenesCompra/Firmas/` |
| 2 | `Features/Config/Workflow/Handlers/WorkflowHandlerContext.cs` | Movido |
| 3 | `Features/Config/Workflow/Handlers/FieldWorkflowHandler.cs` | Movido |
| 4 | `Features/Config/Workflow/Handlers/AlertaWorkflowHandler.cs` | Movido |
| 5 | `Features/Config/Workflow/Handlers/DocumentWorkflowHandler.cs` | Movido |
| 6 | `Features/Config/Workflow/Handlers/ProviderAuthorizationWorkflowHandler.cs` | Movido |
| 7 | `Features/Config/Workflow/Notification/WorkflowNotificationContext.cs` | Nuevo DTO polimórfico (opcional, se eliminará si no se usa) |
| 8 | `Features/Config/Workflow/Notification/IWorkflowNotificationDispatcher.cs` | Movido + refactor firma |
| 9 | `Features/Config/Workflow/Notification/WorkflowNotificationDispatcher.cs` | Movido + refactor body |
| 10 | `Infrastructure/Data/Configurations/Rh/TipoSolicitudesConfiguration.cs` | **NUEVO** — D.0.2 — Fluent API para `rh.tipo_solicitud` |
| 11 | `Features/Rh/SolicitudesPersonal/DTOs/SolicitudPersonalDto.cs` | Nuevo |
| 12 | `Features/Rh/SolicitudesPersonal/DTOs/CrearSolicitudPersonalRequest.cs` | Nuevo |
| 13 | `Features/Rh/SolicitudesPersonal/DTOs/AccionSolicitudRequest.cs` | Nuevo |
| 14 | `Features/Rh/SolicitudesPersonal/DTOs/TipoSolicitudDto.cs` | Nuevo |
| 15 | `Features/Rh/SolicitudesPersonal/SolicitudesPersonalService.cs` | Nuevo |
| 16 | `Features/Rh/SolicitudesPersonal/SolicitudesPersonalController.cs` | Nuevo |
| 17 | `lefarma.database/024_tipo_solicitud.sql` | **NUEVO** — D.0.1 — Crear tabla `rh.tipo_solicitud` |
| 18 | `lefarma.database/025_solicitudes_personal.sql` | Crear tabla `rh.solicitudes_personal` |
| 19 | `lefarma.database/026_seed_workflow_solicitud_personal.sql` | Seed workflow con 4 pasos |
| 20 | `lefarma.database/027_seed_tipos_solicitud.sql` | Seed 3 tipos base (PERMISO_PERSONAL, INCIDENCIA_FALTA, COMISION) |
| 21 | `lefarma.database/028_workflow_canal_templates_per_proceso.sql` | Agregar columnas polimórficas a `workflow_canal_templates` |

### Modificados (5 archivos)

| Archivo | Cambio |
|---|---|
| `Features/OrdenesCompra/Firmas/FirmasService.cs` | Mover `BuildPartidasTable` aquí; pasar `variablesExtra` con OC-specific vars al dispatcher |
| `Features/Config/Workflows/Notification/WorkflowNotificationDispatcher.cs` | Refactor: usar caché local `templatesPorCanal` + `GetTemplateAsync`; parametrizar `BuildEmailHtmlFallback` (B.5.1) |
| `Infrastructure/Data/Configurations/Config/WorkflowBitacoraConfiguration.cs` | Verificar/aplicar schema polimórfico |
| `Infrastructure/Data/Configurations/Config/WorkflowCanalTemplateConfiguration.cs` | Mapear `codigo_proceso`, `subtitulo`, `texto_boton`, `url_entidad_template`; cambiar unique index |
| `Domain/Entities/Config/WorkflowCanalTemplate.cs` | Agregar las 4 propiedades nuevas |
| `ApplicationDbContext.cs` | Agregar `DbSet<TipoSolicitud> TiposSolicitud` (D.0.3) |
| `Program.cs` | Registrar `SolicitudesPersonalService` |
| Cualquier archivo con `using Lefarma.API.Features.OrdenesCompra.Firmas.Handlers` | Actualizar a `Features.Config.Workflow.Handlers` |

### Eliminados

- `Features/OrdenesCompra/Firmas/Handlers/` (directorio completo) — todo se movió
- `Features/OrdenesCompra/Firmas/IWorkflowNotificationDispatcher.cs` — movido
- `Features/OrdenesCompra/Firmas/WorkflowNotificationDispatcher.cs` — movido

---

## Orden de Ejecución Recomendado

```
FASE A: Reorganización
  A.1 Crear carpetas nuevas
  A.2 Mover 5 archivos de handlers + 1 context
  A.3 Actualizar namespaces
  A.4 Actualizar usings en archivos que referencian
  A.5 dotnet build → fix errores

FASE B: NotificationDispatcher
  B.1 Crear WorkflowNotificationContext.cs (nueva ubicación)
  B.2 Mover y refactorizar IWorkflowNotificationDispatcher
  B.3 Mover y refactorizar WorkflowNotificationDispatcher
  B.4 Mover BuildPartidasTable a FirmasService
  B.5 Actualizar FirmasService para construir contexto
  B.6 dotnet build → fix errores
  B.7 Probar OC end-to-end (crear OC, firmar, verificar notificación)

FASE C: Verificar SQL migraciones
  C.1 Confirmar/aplicar migración 021
  C.2 Confirmar EF Configuration de WorkflowBitacora

FASE D: Módulo SolicitudesPersonal
  D.1 SQL 025 (tabla)
  D.2 DTOs (4 archivos)
  D.3 Service (SolicitudesPersonalService.cs)
  D.4 Controller
  D.5 Program.cs (DI)
  D.6 dotnet build → fix errores

FASE E: Seed
  E.1 SQL 026 (workflow)
  E.2 SQL 027 (tipos, opcional)
  E.3 Configurar panel admin o SQL mapping

FASE F: Verificación
  F.1 Build
  F.2 Tests
  F.3 Validación manual
```

---

## Estimación de Esfuerzo

| Fase | Días |
|---|---|
| A. Reorganización arquitectónica | 1 |
| B. NotificationDispatcher genérico | 2-3 |
| C. Verificar SQL | 0.5 |
| D. Módulo SolicitudesPersonal | 2-3 |
| E. Seed | 0.5 |
| **Total** | **6-8 días** |

Mucho menos que el plan v3 original (9-12 días) porque la mayor parte del refactor del engine ya está hecho.
