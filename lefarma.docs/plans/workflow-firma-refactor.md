# Plan v1: Refactor de Firmas + Creación de `WorkflowQueryService`

## Contexto y motivación

Hoy en día el sistema tiene **duplicación de lógica de workflow** entre `FirmasService` (OC) y `SolicitudesPersonalService`:

| Problema | Impacto |
|---|---|
| `SolicitudesPersonalService.FirmarAsync` (líneas 141-201) **no valida participantes** — cualquier usuario podría firmar | 🔴 **Crítico**: bug de seguridad |
| `SolicitudesPersonalService.GetAccionesDisponiblesAsync` (líneas 229-245) solo devuelve 4 campos — **sin handlers, sin pre-evaluación, sin metadata** | 🟠 **Incompleto**: UX rota en frontend |
| `SolicitudesPersonalService.FirmarAsync` **no usa `Task.Run` fire-and-forget** — la notificación bloquea el request HTTP | 🟡 **Performance** |
| `SolicitudesPersonalService.FirmarAsync` no hereda de `BaseService` — sin `EnrichWideEvent` ni logging estructurado | 🟡 **Observabilidad** |
| `SolicitudesPersonalController.Firmar` usa ruta `/acciones` en vez de `/firmar` | 🟡 **Inconsistencia** con OC |
| 3 métodos en `FirmasService` (`GetAccionesAsync`, `GetAccionMetadataAsync`, `GetHistorialWorkflowAsync`) son **95-98% genéricos** pero están hardcoded a OC | 🟠 **Duplicación** |

**Objetivo**: Extraer la lógica genérica a un servicio compartido, crear `SolicitudPersonalFirmasService` con paridad funcional, y consolidar los endpoints de workflow en los controllers de dominio.

---

## Arquitectura final

```
Features/
├── Config/Workflows/
│   ├── WorkflowService.cs              ← CRUD (sin cambios)
│   ├── WorkflowQueryService.cs         ← NUEVO: queries genéricas
│   ├── IWorkflowQueryService.cs        ← NUEVO
│   ├── WorkflowFirmaHelper.cs          ← NUEVO: helpers estáticos puros
│   ├── Notification/
│   │   ├── IWorkflowNotificationDispatcher.cs  (refactor firma ya planeado en plan v4)
│   │   └── WorkflowNotificationDispatcher.cs
│   ├── DTOs/
│   │   ├── WorkflowAccionDTOs.cs       ← NUEVO: DTOs compartidos (movidos desde OC Firmas)
│   │   └── (otros DTOs existentes)
│   └── ...
│
├── OrdenesCompra/
│   ├── OrdenesCompraController.cs      ← MODIFICADO: recibe endpoints de firma
│   ├── Firmas/
│   │   ├── OrdenCompraFirmasService.cs ← RENOMBRADO desde FirmasService.cs
│   │   ├── IFirmasService.cs           ← RENOMBRADO
│   │   └── FirmaExternoController.cs   ← MOVIDO a Concentrados/
│   └── Concentrados/
│       ├── ConcentradosService.cs      ← NUEVO (extraído de FirmasService)
│       └── ConcentradosController.cs   ← NUEVO
│
└── Rh/SolicitudesPersonal/
    ├── SolicitudesPersonalController.cs ← MODIFICADO: rutas /firmar, recibe endpoints
    ├── SolicitudPersonalFirmasService.cs ← NUEVO
    └── ISolicitudPersonalFirmasService.cs ← NUEVO
```

---

## Fase A: Extraer DTOs compartidos

### A.1 Crear `Features/Config/Workflows/DTOs/WorkflowAccionDTOs.cs`

**Por qué**: Los DTOs de `AccionDisponibleResponse`, `AccionMetadataResponse`, `FirmarRequest`, `FirmarResponse`, `HistorialWorkflowItemResponse` son 100% genéricos. Moverlos aquí permite que cualquier entidad workflowable los use sin depender de OC.

```csharp
namespace Lefarma.API.Features.Config.Workflows.DTOs;

public class FirmarRequest
{
    public required int IdAccion { get; set; }
    public string? Comentario { get; set; }
    public Dictionary<string, object>? DatosAdicionales { get; set; }
}

public class FirmarResponse
{
    public bool Exitoso { get; set; }
    public string Folio { get; set; } = string.Empty;
    public string? EstadoAnterior { get; set; }
    public string? NuevoEstado { get; set; }
    public string? Mensaje { get; set; }
}

public class AccionDisponibleResponse
{
    public int IdAccion { get; set; }
    public int IdTipoAccion { get; set; }
    public string? TipoAccionCodigo { get; set; }
    public string? TipoAccionNombre { get; set; }
    public bool? TipoAccionCambiaEstado { get; set; }
    public bool EnviaConcentrado { get; set; }
    
    public List<AccionHandlerMetadataResponse> Handlers { get; set; } = new();
    public List<WorkflowCampoMetadataResponse> CamposWorkflow { get; set; } = new();
    public List<string> CamposRequeridos { get; set; } = new();
    
    public bool RequiereComentario { get; set; }
    public bool RequiereAdjunto { get; set; }
    public bool PermiteAdjunto { get; set; }
}

public class AccionHandlerMetadataResponse
{
    public int IdHandler { get; set; }
    public string HandlerKey { get; set; } = string.Empty;
    public bool Requerido { get; set; } = true;
    public string? ConfiguracionJson { get; set; }
    public int OrdenEjecucion { get; set; }
    public WorkflowCampoMetadataResponse? Campo { get; set; }
    public bool? ValidacionExito { get; set; }
    public string? ValidacionMensaje { get; set; }
}

public class WorkflowCampoMetadataResponse
{
    public int IdWorkflowCampo { get; set; }
    public string NombreTecnico { get; set; } = string.Empty;
    public string EtiquetaUsuario { get; set; } = string.Empty;
    public string TipoControl { get; set; } = string.Empty;
    public string? SourceCatalog { get; set; }
}

public class AccionMetadataResponse
{
    public int IdEntidad { get; set; }           // ← RENOMBRADO desde IdOrden
    public int IdAccion { get; set; }
    public int IdTipoAccion { get; set; }
    public string? TipoAccionCodigo { get; set; }
    public string? TipoAccionNombre { get; set; }
    public bool? TipoAccionCambiaEstado { get; set; }
    public bool RequiereComentario { get; set; }
    public bool RequiereAdjunto { get; set; }
    public bool PermiteAdjunto { get; set; }
    public List<AccionHandlerMetadataResponse> Handlers { get; set; } = new();
    public List<WorkflowCampoMetadataResponse> CamposWorkflow { get; set; } = new();
    public List<string> CamposRequeridos { get; set; } = new();
}

public class HistorialWorkflowItemResponse
{
    public int IdEvento { get; set; }
    public int IdEntidad { get; set; }          // ← RENOMBRADO desde IdOrden
    public int IdPaso { get; set; }
    public string? NombrePaso { get; set; }
    public int IdAccion { get; set; }
    public string? NombreAccion { get; set; }
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    public string? Comentario { get; set; }
    public string? DatosSnapshot { get; set; }
    public DateTime FechaEvento { get; set; }
}
```

### A.2 Eliminar duplicados de `Features/OrdenesCompra/Firmas/DTOs/FirmasDTOs.cs`

Borrar del archivo las clases que se movieron a `WorkflowAccionDTOs.cs`:
- `FirmarRequest`
- `FirmarResponse`
- `AccionDisponibleResponse`
- `AccionHandlerMetadataResponse`
- `WorkflowCampoMetadataResponse`
- `AccionMetadataResponse`
- `HistorialWorkflowItemResponse`

**Mantener** en `FirmasDTOs.cs`:
- `EnvioConcentradoRequest`
- `EnvioConcentradoItemResult`
- `EnvioConcentradoResponse`
- `EnvioConcentradoConPdfRequest`
- `RespuestaConcentradoExternoRequest`
- `RespuestaConcentradoResponse`
- `AsokamLoginResponse` (usado por `FirmaExternoController`)

**Renombrar archivo** a `ConcentradosDTOs.cs` cuando se cree `Features/OrdenesCompra/Concentrados/`.

### A.3 Actualizar `using` en archivos que importaban los DTOs desde OC

```bash
# Buscar todas las referencias
grep -rln "Lefarma.API.Features.OrdenesCompra.Firmas.DTOs" lefarma.backend/
```

Actualizar a `Lefarma.API.Features.Config.Workflows.DTOs` en:
- `FirmasController.cs`
- `FirmasService.cs`
- `SolicitudesPersonalService.cs` (usa `FirmarResponse`)
- Cualquier test que los importe

---

## Fase B: Crear `WorkflowQueryService`

### B.1 Crear `Features/Config/Workflows/IWorkflowQueryService.cs`

```csharp
using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Config.Workflows;

public interface IWorkflowQueryService
{
    /// <summary>
    /// Devuelve las acciones disponibles para el usuario en el paso actual de la entidad,
    /// incluyendo handlers pre-evaluados y metadata del paso (RequiereComentario, etc.).
    /// </summary>
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idWorkflow,
        int idEntidad,
        int idPasoActual,
        int idUsuario,
        string tipoEntidad,
        IWorkflowEntity entidadParaHandlers,
        CancellationToken ct = default);

    /// <summary>
    /// Devuelve metadata de una acción específica (handlers, campos, requisitos del paso).
    /// Usado por el frontend para construir el modal dinámico antes de ejecutar.
    /// </summary>
    Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idWorkflow,
        int idPasoActual,
        int idAccion,
        int idEntidad,
        CancellationToken ct = default);

    /// <summary>
    /// Devuelve el historial completo de transiciones de workflow para una entidad.
    /// Funciona para cualquier tipo (OC, SolicitudPersonal, futuro) por la columna polimórfica.
    /// </summary>
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(
        int idEntidad,
        string tipoEntidad,
        CancellationToken ct = default);
}
```

**Decisión de diseño**: `GetAccionesDisponiblesAsync` recibe `IWorkflowEntity entidadParaHandlers` porque la pre-evaluación de handlers necesita la entidad concreta para construir el `WorkflowHandlerContext`. Cada servicio de dominio pasa su entidad (`OrdenCompra` o `SolicitudPersonal`).

### B.2 Crear `Features/Config/Workflows/WorkflowQueryService.cs`

```csharp
using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Lefarma.API.Features.Config.Workflows;

public class WorkflowQueryService : BaseService, IWorkflowQueryService
{
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IServiceProvider _serviceProvider;
    protected override string EntityName => "WorkflowQuery";

    public WorkflowQueryService(
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IServiceProvider serviceProvider,
        IWideEventAccessor wideEventAccessor) : base(wideEventAccessor)
    {
        _engine = engine;
        _workflowRepo = workflowRepo;
        _context = context;
        _asokamContext = asokamContext;
        _serviceProvider = serviceProvider;
    }

    public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idWorkflow,
        int idEntidad,
        int idPasoActual,
        int idUsuario,
        string tipoEntidad,
        IWorkflowEntity entidadParaHandlers,
        CancellationToken ct = default)
    {
        try
        {
            if (idWorkflow == 0)
                return CommonErrors.Conflict("Workflow", "La entidad no tiene workflow asignado.");

            // 1. Acciones que el motor permite (filtra por participante, estado, etc.)
            var acciones = await _engine.GetAccionesDisponiblesAsync(
                idWorkflow, idEntidad, idUsuario, tipoEntidad);

            // 2. Cargar paso actual para metadata (RequiereComentario, etc.)
            var pasoActual = await _context.WorkflowPasos
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdPaso == idPasoActual, ct);

            // 3. Cargar todos los campos del workflow una sola vez
            var camposWorkflow = (await _workflowRepo.GetCamposAsync()).ToList();

            // 4. Por cada acción, cargar sus handlers y construir DTO
            var result = new List<AccionDisponibleResponse>();
            foreach (var a in acciones)
            {
                var handlers = (await _workflowRepo.GetAccionHandlersAsync(a.IdAccion)).ToList();
                var camposRequeridos = handlers
                    .Where(h => h.Requerido && h.Campo != null)
                    .Select(h => h.Campo!.NombreTecnico)
                    .ToList();

                result.Add(new AccionDisponibleResponse
                {
                    IdAccion = a.IdAccion,
                    IdTipoAccion = a.IdTipoAccion,
                    TipoAccionCodigo = a.TipoAccion?.Codigo,
                    TipoAccionNombre = a.TipoAccion?.Nombre,
                    TipoAccionCambiaEstado = a.TipoAccion?.CambiaEstado,
                    EnviaConcentrado = a.EnviaConcentrado,
                    Handlers = handlers.Select(h => new AccionHandlerMetadataResponse
                    {
                        IdHandler = h.IdHandler,
                        HandlerKey = h.HandlerKey,
                        Requerido = h.Requerido,
                        ConfiguracionJson = h.ConfiguracionJson,
                        OrdenEjecucion = h.OrdenEjecucion,
                        Campo = h.Campo != null ? new WorkflowCampoMetadataResponse
                        {
                            IdWorkflowCampo = h.Campo.IdWorkflowCampo,
                            NombreTecnico = h.Campo.NombreTecnico,
                            EtiquetaUsuario = h.Campo.EtiquetaUsuario,
                            TipoControl = h.Campo.TipoControl,
                            SourceCatalog = h.Campo.SourceCatalog
                        } : null
                    }).ToList(),
                    CamposWorkflow = camposWorkflow.Select(c => new WorkflowCampoMetadataResponse
                    {
                        IdWorkflowCampo = c.IdWorkflowCampo,
                        NombreTecnico = c.NombreTecnico,
                        EtiquetaUsuario = c.EtiquetaUsuario,
                        TipoControl = c.TipoControl,
                        SourceCatalog = c.SourceCatalog
                    }).ToList(),
                    CamposRequeridos = camposRequeridos,
                    RequiereComentario = pasoActual?.RequiereComentario ?? false,
                    RequiereAdjunto = pasoActual?.RequiereAdjunto ?? false,
                    PermiteAdjunto = pasoActual?.PermiteAdjunto ?? false
                });
            }

            // 5. Pre-evaluar handlers que tengan "mensaje" en su configuracionJson
            await PreEvaluarHandlersAsync(result, entidadParaHandlers, idEntidad, tipoEntidad, idUsuario, ct);

            EnrichWideEvent("GetAccionesDisponibles", entityId: idEntidad, count: result.Count);
            return result;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetAccionesDisponibles", entityId: idEntidad, exception: ex);
            return CommonErrors.DatabaseError("obtener las acciones disponibles");
        }
    }

    private async Task PreEvaluarHandlersAsync(
        List<AccionDisponibleResponse> acciones,
        IWorkflowEntity entidad,
        int idEntidad,
        string tipoEntidad,
        int idUsuario,
        CancellationToken ct)
    {
        foreach (var response in acciones)
        {
            foreach (var handlerMeta in response.Handlers)
            {
                if (string.IsNullOrWhiteSpace(handlerMeta.ConfiguracionJson))
                    continue;

                string? mensaje = null;
                try
                {
                    using var doc = JsonDocument.Parse(handlerMeta.ConfiguracionJson);
                    if (doc.RootElement.TryGetProperty("mensaje", out var m))
                        mensaje = m.GetString();
                }
                catch { }

                if (mensaje is null) continue;

                // Alerta: solo informativo, siempre exito
                if (handlerMeta.HandlerKey == "Alerta")
                {
                    handlerMeta.ValidacionExito = true;
                    handlerMeta.ValidacionMensaje = mensaje;
                    continue;
                }

                // Demás handlers: ejecutar el handler real
                try
                {
                    var actionHandler = _serviceProvider.GetKeyedService<IWorkflowActionHandler>(handlerMeta.HandlerKey);
                    if (actionHandler == null) continue;

                    var ctx = new WorkflowHandlerContext(
                        Entidad: entidad,
                        IdEntidad: idEntidad,
                        TipoEntidad: tipoEntidad,
                        IdAccion: response.IdAccion,
                        IdUsuario: idUsuario,
                        Comentario: null,
                        DatosAdicionales: null);

                    var vr = await actionHandler.ProcessAsync(ctx, handlerMeta.ConfiguracionJson);
                    handlerMeta.ValidacionExito = vr.Exitoso;
                    handlerMeta.ValidacionMensaje = vr.Exitoso ? mensaje : (vr.Error ?? mensaje);
                }
                catch
                {
                    handlerMeta.ValidacionExito = null;
                    handlerMeta.ValidacionMensaje = mensaje;
                }
            }
        }
    }

    public async Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idWorkflow,
        int idPasoActual,
        int idAccion,
        int idEntidad,
        CancellationToken ct = default)
    {
        try
        {
            var pasoActual = await _context.WorkflowPasos
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdPaso == idPasoActual && p.Activo, ct);
            if (pasoActual is null)
                return CommonErrors.NotFound("PasoWorkflow", idPasoActual.ToString());

            var accion = await _context.WorkflowAcciones
                .AsNoTracking()
                .Include(a => a.TipoAccion)
                .FirstOrDefaultAsync(a => a.IdAccion == idAccion && a.Activo, ct);
            if (accion is null)
                return CommonErrors.NotFound("Accion", idAccion.ToString());

            var handlers = (await _workflowRepo.GetAccionHandlersAsync(idAccion)).ToList();
            var campos = (await _workflowRepo.GetCamposAsync()).ToList();

            var camposRequeridos = handlers
                .Where(h => h.Requerido && h.Campo != null)
                .Select(h => h.Campo!.NombreTecnico)
                .ToList();

            return new AccionMetadataResponse
            {
                IdEntidad = idEntidad,
                IdAccion = accion.IdAccion,
                IdTipoAccion = accion.IdTipoAccion,
                TipoAccionCodigo = accion.TipoAccion?.Codigo,
                TipoAccionNombre = accion.TipoAccion?.Nombre,
                TipoAccionCambiaEstado = accion.TipoAccion?.CambiaEstado,
                RequiereComentario = pasoActual.RequiereComentario,
                RequiereAdjunto = pasoActual.RequiereAdjunto,
                PermiteAdjunto = pasoActual.PermiteAdjunto,
                Handlers = handlers.Select(h => new AccionHandlerMetadataResponse
                {
                    IdHandler = h.IdHandler,
                    HandlerKey = h.HandlerKey,
                    Requerido = h.Requerido,
                    ConfiguracionJson = h.ConfiguracionJson,
                    OrdenEjecucion = h.OrdenEjecucion
                }).ToList(),
                CamposWorkflow = campos.Select(c => new WorkflowCampoMetadataResponse
                {
                    IdWorkflowCampo = c.IdWorkflowCampo,
                    NombreTecnico = c.NombreTecnico,
                    EtiquetaUsuario = c.EtiquetaUsuario,
                    TipoControl = c.TipoControl,
                    SourceCatalog = c.SourceCatalog
                }).ToList(),
                CamposRequeridos = camposRequeridos
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetAccionMetadata", entityId: idEntidad, exception: ex);
            return CommonErrors.DatabaseError("obtener metadatos de acción");
        }
    }

    public async Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(
        int idEntidad,
        string tipoEntidad,
        CancellationToken ct = default)
    {
        try
        {
            var historial = await _context.WorkflowBitacoras
                .AsNoTracking()
                .Where(b => b.TipoEntidad == tipoEntidad && b.IdEntidad == idEntidad)
                .OrderByDescending(b => b.FechaEvento)
                .Select(b => new HistorialWorkflowItemResponse
                {
                    IdEvento = b.IdEvento,
                    IdEntidad = b.IdEntidad,
                    IdPaso = b.IdPaso,
                    NombrePaso = b.Paso != null ? b.Paso.NombrePaso : null,
                    IdAccion = b.IdAccion,
                    NombreAccion = b.Accion != null && b.Accion.TipoAccion != null ? b.Accion.TipoAccion.Nombre : null,
                    IdUsuario = b.IdUsuario,
                    NombreUsuario = null,
                    Comentario = b.Comentario,
                    DatosSnapshot = b.DatosSnapshot,
                    FechaEvento = b.FechaEvento
                })
                .ToListAsync(ct);

            if (historial.Count == 0)
            {
                EnrichWideEvent("GetHistorialWorkflow", entityId: idEntidad, count: 0);
                return new List<HistorialWorkflowItemResponse>();
            }

            var userIds = historial.Select(h => h.IdUsuario).Distinct().ToList();
            var userMap = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => userIds.Contains(u.IdUsuario))
                .Select(u => new { u.IdUsuario, u.NombreCompleto })
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);

            foreach (var item in historial)
            {
                if (userMap.TryGetValue(item.IdUsuario, out var nombre))
                    item.NombreUsuario = nombre;
            }

            EnrichWideEvent("GetHistorialWorkflow", entityId: idEntidad, count: historial.Count);
            return historial;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetHistorialWorkflow", entityId: idEntidad, exception: ex);
            return CommonErrors.DatabaseError("obtener historial de workflow");
        }
    }
}
```

### B.3 Registrar en `Program.cs`

```csharp
builder.Services.AddScoped<IWorkflowQueryService, WorkflowQueryService>();
```

---

## Fase C: Crear `WorkflowFirmaHelper`

### C.1 Crear `Features/Config/Workflows/WorkflowFirmaHelper.cs`

Helpers estáticos puros, sin estado. Reciben dependencias por parámetro.

```csharp
using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Features.Config.Workflows.Notification;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Config.Workflows;

public static class WorkflowFirmaHelper
{
    /// <summary>
    /// Valida que el usuario puede ejecutar acciones en el paso actual.
    /// - Si es paso inicial y es el creador: siempre puede
    /// - Si hay participantes explícitos: debe estar en la lista (por usuario o por rol)
    /// </summary>
    public static async Task<ErrorOr<Success>> ValidarParticipanteAsync(
        WorkflowPaso pasoActual,
        int idUsuario,
        int idUsuarioCreador,
        AsokamDbContext asokamContext,
        CancellationToken ct = default)
    {
        // Paso inicial: el creador siempre puede ejecutar (es quien envía)
        if (pasoActual.EsInicio && idUsuario == idUsuarioCreador)
            return Result.Success;

        // Si el paso tiene participantes explícitos, validar
        var participantesActivos = pasoActual.Participantes?.Where(p => p.Activo).ToList() ?? new();
        if (participantesActivos.Count == 0)
            return Result.Success; // Sin participantes = sin restricción

        // Verificar por usuario directo
        var esParticipante = participantesActivos.Any(p => p.IdUsuario == idUsuario);
        if (esParticipante)
            return Result.Success;

        // Verificar por rol del usuario
        var rolesUsuario = await asokamContext.UsuariosRoles
            .Where(ur => ur.IdUsuario == idUsuario
                      && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.Now))
            .Select(ur => ur.IdRol)
            .ToListAsync(ct);

        if (participantesActivos.Any(p => p.IdRol.HasValue && rolesUsuario.Contains(p.IdRol.Value)))
            return Result.Success;

        return Error.Validation("Autorizacion", "No eres participante de este paso del workflow.");
    }

    /// <summary>
    /// Resuelve la notificación a disparar para (idAccion, idPasoDestino).
    /// Prioridad: match exacto por (idAccion, idPasoDestino) > match por (idAccion, idPasoDestino=null).
    /// </summary>
    public static WorkflowNotificacion? ResolverNotificacion(
        Workflow workflow,
        int idAccion,
        int? idPasoDestino)
    {
        if (workflow.Pasos == null) return null;

        return workflow.Pasos
            .SelectMany(p => p.AccionesOrigen ?? new List<WorkflowAccion>())
            .Where(a => a.IdAccion == idAccion)
            .SelectMany(a => a.Notificaciones ?? new List<WorkflowNotificacion>())
            .Where(n => n.Activo)
            .FirstOrDefault(n => n.IdPasoDestino == idPasoDestino)
            ?? workflow.Pasos
                .SelectMany(p => p.AccionesOrigen ?? new List<WorkflowAccion>())
                .Where(a => a.IdAccion == idAccion)
                .SelectMany(a => a.Notificaciones ?? new List<WorkflowNotificacion>())
                .Where(n => n.Activo && n.IdPasoDestino == null)
                .FirstOrDefault();
    }

    /// <summary>
    /// Despacha la notificación de forma asíncrona (fire-and-forget).
    /// Crea su propio scope porque el DbContext del request HTTP ya terminó.
    /// </summary>
    public static void DispatchNotificacionFireAndForget(
        IServiceScopeFactory scopeFactory,
        WorkflowNotificacion? notificacion,
        string tipoEntidad,
        int idEntidad,
        string folio,
        int idUsuarioCreador,
        Dictionary<string, string>? variablesExtra,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        string? contenidoAdicionalHtml = null)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var dispatcher = scope.ServiceProvider
                    .GetRequiredService<IWorkflowNotificationDispatcher>();
                await dispatcher.DispatchAsync(
                    notificacion: notificacion,
                    tipoEntidad: tipoEntidad,
                    idEntidad: idEntidad,
                    folio: folio,
                    idUsuarioCreador: idUsuarioCreador,
                    variablesExtra: variablesExtra,
                    idPasoDestino: idPasoDestino,
                    idUsuarioActual: idUsuarioActual,
                    comentario: comentario,
                    contenidoAdicionalHtml: contenidoAdicionalHtml);
            }
            catch
            {
                // Log silencioso; la firma ya se ejecutó
            }
        });
    }
}
```

---

## Fase D: Refactor `FirmasService` → `OrdenCompraFirmasService`

### D.1 Renombrar archivos

| Antes | Después |
|---|---|
| `Features/OrdenesCompra/Firmas/FirmasService.cs` | `Features/OrdenesCompra/Firmas/OrdenCompraFirmasService.cs` |
| `Features/OrdenesCompra/Firmas/IFirmasService.cs` | `Features/OrdenesCompra/Firmas/IOrdenCompraFirmasService.cs` |
| `Features/OrdenesCompra/Firmas/FirmasController.cs` | **ELIMINADO** (rutas se mueven a `OrdenesCompraController.cs`) |
| `Features/OrdenesCompra/Firmas/FirmaExternoController.cs` | `Features/OrdenesCompra/Concentrados/ConcentradosExternoController.cs` |

**Renombrar clase** `FirmasService` → `OrdenCompraFirmasService` e `IFirmasService` → `IOrdenCompraFirmasService`.

### D.2 Actualizar `OrdenCompraFirmasService.FirmarAsync`

**Cambios clave**:

1. **Eliminar** `GetAccionesAsync`, `GetAccionMetadataAsync`, `GetHistorialWorkflowAsync` — delegados a `IWorkflowQueryService`
2. **Eliminar** `GetAccionHandlersAsync` reference, `GetCamposAsync` reference
3. **Eliminar** `BuildPartidasTable` (queda como helper local)
4. **Refactorizar** las secciones marcadas con `WorkflowFirmaHelper`:

```csharp
public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idOrden, FirmarRequest request, int idUsuario)
{
    try
    {
        // 1. Cargar orden con partidas
        var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
        if (orden is null)
        {
            EnrichWideEvent("Firmar", entityId: idOrden, notFound: true);
            return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());
        }

        // 2. Validar estado no terminal
        if (orden.IdEstado == 7 || orden.IdEstado == 9)
            return CommonErrors.Conflict("OrdenCompra", $"La orden {orden.Folio} ya está cerrada o cancelada.");

        // 3. Cargar workflow config con todas las navegaciones necesarias
        var workflowConfig = await _workflowRepo.GetQueryable()
            .Include(w => w.Pasos)
                .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.Notificaciones)
                        .ThenInclude(n => n.Canales)
            .Include(w => w.Pasos)
                .ThenInclude(p => p.Participantes)
            .FirstOrDefaultAsync(w => w.IdWorkflow == orden.IdWorkflow);

        if (workflowConfig is null)
            return CommonErrors.NotFound("Workflow", orden.IdWorkflow.ToString());

        // 4. Validar paso actual
        var pasoActual = workflowConfig.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual);
        if (pasoActual is null || !pasoActual.Activo)
            return CommonErrors.Conflict("orden", "La orden no tiene un paso activo válido.");

        // 5. ★ Validar participante (USANDO HELPER)
        var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
            pasoActual, idUsuario, orden.IdUsuarioCreador, _asokamContext);
        if (validacion.IsError)
            return validacion.Errors;

        var estadoAnterior = orden.Estado?.Codigo;

        // 6. Construir contexto con datos adicionales (Total para condiciones)
        var datosAdicionales = request.DatosAdicionales ?? new Dictionary<string, object>();
        datosAdicionales["Total"] = orden.Total;

        // 7. Ejecutar motor de workflow
        var ctx = new WorkflowContext(
            IdWorkflow: orden.IdWorkflow,
            IdEntidad: orden.IdOrden,
            TipoEntidad: CodigoProceso.ORDEN_COMPRA,
            Entidad: orden,
            IdAccion: request.IdAccion,
            IdUsuario: idUsuario,
            Orden: orden,
            Comentario: request.Comentario,
            DatosAdicionales: datosAdicionales);
        var resultado = await _engine.EjecutarAccionAsync(ctx);
        if (!resultado.Exitoso)
            return CommonErrors.Validation("Workflow", resultado.Error ?? "Error en el motor de workflow.");

        // 8. Lógica específica OC: reset facturación en DEVOLVER
        await ProcesarDevolucionSiAplicaAsync(workflowConfig, request.IdAccion, idOrden);

        // 9. Actualizar estado de la orden + fechas de ciclo de vida
        await ActualizarEstadoYFechasAsync(orden, resultado);

        // 10. Resolver notificación a disparar
        var notificacion = WorkflowFirmaHelper.ResolverNotificacion(
            workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

        // 11. ★ Disparar notificación fire-and-forget (USANDO HELPER)
        var variables = ConstruirVariablesNotificacion(orden);
        var partidasHtml = BuildPartidasTable(orden.Partidas);
        WorkflowFirmaHelper.DispatchNotificacionFireAndForget(
            scopeFactory: _scopeFactory,
            notificacion: notificacion,
            tipoEntidad: CodigoProceso.ORDEN_COMPRA,
            idEntidad: orden.IdOrden,
            folio: orden.Folio,
            idUsuarioCreador: orden.IdUsuarioCreador,
            variablesExtra: variables,
            idPasoDestino: resultado.NuevoIdPaso,
            idUsuarioActual: idUsuario,
            comentario: request.Comentario,
            contenidoAdicionalHtml: partidasHtml);

        EnrichWideEvent("Firmar", entityId: idOrden, nombre: orden.Folio,
            additionalContext: new Dictionary<string, object>
            {
                ["estadoAnterior"] = estadoAnterior,
                ["nuevoEstado"] = orden.IdEstado,
                ["idAccion"] = request.IdAccion,
                ["idPasoDestino"] = resultado.NuevoIdPaso
            });

        return new FirmarResponse
        {
            Exitoso = true,
            Folio = orden.Folio,
            EstadoAnterior = estadoAnterior,
            NuevoEstado = orden.IdEstado.ToString(),
            Mensaje = $"Acción ejecutada exitosamente. Estado: {orden.Estado}"
        };
    }
    catch (Exception ex)
    {
        EnrichWideEvent("Firmar", entityId: idOrden, exception: ex);
        return CommonErrors.InternalServerError("Error inesperado al procesar la firma.");
    }
}

private async Task ProcesarDevolucionSiAplicaAsync(Workflow workflow, int idAccion, int idOrden)
{
    var accionEntity = workflow.Pasos
        .SelectMany(p => p.AccionesOrigen)
        .FirstOrDefault(a => a.IdAccion == idAccion);
    if (accionEntity?.TipoAccion?.Codigo != "DEVOLVER") return;

    var idPartidas = await _context.OrdenesCompraPartidas
        .Where(p => p.IdOrden == idOrden)
        .Select(p => p.IdPartida)
        .ToListAsync();

    if (idPartidas.Count == 0) return;

    await _context.OrdenesCompraPartidas
        .Where(p => idPartidas.Contains(p.IdPartida))
        .ExecuteUpdateAsync(s => s
            .SetProperty(p => p.CantidadFacturada, 0m)
            .SetProperty(p => p.ImporteFacturado, 0m)
            .SetProperty(p => p.EstadoFacturacion, (byte)0));

    var idsComprobantes = await _context.ComprobantesPartidas
        .Where(cp => idPartidas.Contains(cp.IdPartida))
        .Select(cp => cp.IdComprobante)
        .Distinct()
        .ToListAsync();

    if (idsComprobantes.Count > 0)
    {
        await _context.Comprobantes
            .Where(c => idsComprobantes.Contains(c.IdComprobante))
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Estado, (byte)3)
                .SetProperty(c => c.FechaModificacion, DateTime.Now));
    }
}

private async Task ActualizarEstadoYFechasAsync(OrdenCompra orden, WorkflowEjecucionResult resultado)
{
    var nuevoIdEstado = resultado.NuevoIdEstado;
    if (nuevoIdEstado.HasValue)
    {
        orden.IdEstado = nuevoIdEstado.Value;

        var estados = await _context.WorkflowEstados
            .Where(e => e.Activo)
            .ToDictionaryAsync(e => e.Codigo!, e => e.IdEstado);

        var idAprobacion = estados.GetValueOrDefault(WorkflowEstadoCodigo.APROBACION);
        var idTesoreria = estados.GetValueOrDefault(WorkflowEstadoCodigo.TESORERIA);
        var idPagada = estados.GetValueOrDefault(WorkflowEstadoCodigo.PAGADA);
        var idCerrada = estados.GetValueOrDefault(WorkflowEstadoCodigo.CERRADA);
        var idRechazada = estados.GetValueOrDefault(WorkflowEstadoCodigo.RECHAZADA);
        var idCancelada = estados.GetValueOrDefault(WorkflowEstadoCodigo.CANCELADA);

        if (nuevoIdEstado == idAprobacion) orden.FechaSolicitud = DateTime.Now;
        if (nuevoIdEstado == idTesoreria) orden.FechaAutorizacion = DateTime.Now;
        if (nuevoIdEstado == idPagada || (nuevoIdEstado == idCerrada && orden.IdEstado == idTesoreria))
            orden.FechaPago = DateTime.Now;
        if (nuevoIdEstado == idCerrada) orden.FechaCierre = DateTime.Now;
        if (nuevoIdEstado == idRechazada) orden.FechaRechazo = DateTime.Now;
        if (nuevoIdEstado == idCancelada) orden.FechaCancelacion = DateTime.Now;
    }

    orden.IdPasoActual = resultado.NuevoIdPaso;
    orden.FechaModificacion = DateTime.Now;
    await _ordenRepo.UpdateAsync(orden);
}

private static Dictionary<string, string> ConstruirVariablesNotificacion(OrdenCompra orden) => new()
{
    ["Total"] = orden.Total.ToString("C2"),
    ["Proveedor"] = orden.Proveedor?.RazonSocial ?? "",
    ["CentroCosto"] = orden.CentroCosto?.Nombre ?? orden.IdCentroCosto?.ToString() ?? "",
    ["CuentaContable"] = orden.CuentaContable?.Cuenta ?? orden.IdCuentaContable?.ToString() ?? "",
    ["ImportePagado"] = ""
};

private static string BuildPartidasTable(ICollection<OrdenCompraPartida> partidas)
{
    // Mover la lógica existente (líneas 326-371 del FirmasService actual)
    // sin cambios al cuerpo. Solo cambia de ubicación.
}
```

### D.3 Mover métodos de concentrado a `ConcentradosService`

Crear `Features/OrdenesCompra/Concentrados/ConcentradosService.cs` con:
- `EnvioConcentradoAsync` (mover desde FirmasService líneas 562-805)
- `EnvioConcentradoConPdfAsync`
- `ProcesarRespuestaConcentradoAsync`

**Lógica interna**: estos métodos llaman a `FirmarAsync` de `OrdenCompraFirmasService` para cada orden (reutilización).

### D.4 Eliminar de `OrdenCompraFirmasService`

| Método | Destino |
|---|---|
| `GetAccionesAsync` | Eliminado — ahora en `WorkflowQueryService` |
| `GetAccionMetadataAsync` | Eliminado — ahora en `WorkflowQueryService` |
| `GetHistorialWorkflowAsync` | Eliminado — ahora en `WorkflowQueryService` |
| `EnvioConcentradoAsync` | Movido a `ConcentradosService` |
| `EnvioConcentradoConPdfAsync` | Movido a `ConcentradosService` |
| `ProcesarRespuestaConcentradoAsync` | Movido a `ConcentradosService` |

### D.5 Reducir dependencias de `OrdenCompraFirmasService`

```csharp
// ANTES (10 dependencias)
IOrdenCompraRepository ordenRepo,
IWorkflowEngine engine,
IWorkflowRepository workflowRepo,
ApplicationDbContext context,
AsokamDbContext asokamContext,
IServiceScopeFactory scopeFactory,
IServiceProvider serviceProvider,
IHttpClientFactory httpClientFactory,
IConfiguration configuration,
IWideEventAccessor wideEventAccessor

// DESPUÉS (6 dependencias)
IOrdenCompraRepository ordenRepo,
IWorkflowEngine engine,
IWorkflowRepository workflowRepo,
ApplicationDbContext context,
AsokamDbContext asokamContext,
IServiceScopeFactory scopeFactory,
IWideEventAccessor wideEventAccessor
```

Eliminados: `IHttpClientFactory`, `IConfiguration`, `IServiceProvider` (ya no se usa para handlers — `WorkflowQueryService` los maneja).

---

## Fase E: Crear `SolicitudPersonalFirmasService`

### E.1 Crear `Features/Rh/SolicitudesPersonal/ISolicitudPersonalFirmasService.cs`

```csharp
using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

public interface ISolicitudPersonalFirmasService
{
    Task<ErrorOr<FirmarResponse>> FirmarAsync(int idSolicitud, FirmarRequest request, int idUsuario);
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(int idSolicitud, int idUsuario);
    Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(int idSolicitud, int idAccion, int idUsuario);
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idSolicitud);
}
```

### E.2 Crear `Features/Rh/SolicitudesPersonal/SolicitudPersonalFirmasService.cs`

```csharp
using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

public class SolicitudPersonalFirmasService : BaseService, ISolicitudPersonalFirmasService
{
    private readonly ApplicationDbContext _context;
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly IWorkflowQueryService _queryService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AsokamDbContext _asokamContext;
    protected override string EntityName => "SolicitudPersonalFirma";

    public SolicitudPersonalFirmasService(
        ApplicationDbContext context,
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        IWorkflowQueryService queryService,
        IServiceScopeFactory scopeFactory,
        AsokamDbContext asokamContext,
        IWideEventAccessor wideEventAccessor) : base(wideEventAccessor)
    {
        _context = context;
        _engine = engine;
        _workflowRepo = workflowRepo;
        _queryService = queryService;
        _scopeFactory = scopeFactory;
        _asokamContext = asokamContext;
    }

    public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idSolicitud, FirmarRequest request, int idUsuario)
    {
        try
        {
            // 1. Cargar solicitud con estado
            var s = await _context.SolicitudesPersonal
                .Include(x => x.Estado)
                .FirstOrDefaultAsync(x => x.IdSolicitud == idSolicitud);
            if (s is null)
            {
                EnrichWideEvent("Firmar", entityId: idSolicitud, notFound: true);
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());
            }

            // 2. Validar estado no terminal
            if (s.Estado?.Codigo is "CERRADA" or "CANCELADA" or "RECHAZADA" or "APROBADA")
                return CommonErrors.Conflict("SolicitudPersonal",
                    $"La solicitud {s.Folio} ya está en estado terminal.");

            // 3. Cargar workflow config
            var workflowConfig = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.Notificaciones)
                            .ThenInclude(n => n.Canales)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.IdWorkflow == s.IdWorkflow);

            if (workflowConfig is null)
                return CommonErrors.NotFound("Workflow", s.IdWorkflow.ToString());

            var pasoActual = workflowConfig.Pasos.FirstOrDefault(p => p.IdPaso == s.IdPasoActual);
            if (pasoActual is null || !pasoActual.Activo)
                return CommonErrors.Conflict("solicitud", "La solicitud no tiene un paso activo válido.");

            // 4. ★ Validar participante (helper)
            var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
                pasoActual, idUsuario, s.IdUsuarioCreador, _asokamContext);
            if (validacion.IsError)
                return validacion.Errors;

            // 5. Ejecutar motor
            var ctx = new WorkflowContext(
                IdWorkflow: s.IdWorkflow,
                IdEntidad: s.IdSolicitud,
                TipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
                Entidad: s,
                IdAccion: request.IdAccion,
                IdUsuario: idUsuario,
                Orden: null,
                Comentario: request.Comentario,
                DatosAdicionales: request.DatosAdicionales);
            var resultado = await _engine.EjecutarAccionAsync(ctx);
            if (!resultado.Exitoso)
                return CommonErrors.Validation("Workflow", resultado.Error ?? "Error en el motor.");

            // 6. Actualizar estado y campos específicos
            s.IdPasoActual = resultado.NuevoIdPaso;
            if (resultado.NuevoIdEstado.HasValue)
                s.IdEstado = resultado.NuevoIdEstado.Value;

            // Lógica específica SP: setear FechaEnvio en acción ENVIAR
            var accion = workflowConfig.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == request.IdAccion);
            if (accion?.TipoAccion?.Codigo == "ENVIAR" && !s.FechaEnvio.HasValue)
                s.FechaEnvio = DateTime.UtcNow;

            s.FechaModificacion = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // 7. Resolver notificación
            var notificacion = WorkflowFirmaHelper.ResolverNotificacion(
                workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

            // 8. ★ Disparar notificación fire-and-forget (helper)
            var variables = await ConstruirVariablesNotificacionAsync(s);
            WorkflowFirmaHelper.DispatchNotificacionFireAndForget(
                scopeFactory: _scopeFactory,
                notificacion: notificacion,
                tipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
                idEntidad: s.IdSolicitud,
                folio: s.Folio,
                idUsuarioCreador: s.IdUsuarioCreador,
                variablesExtra: variables,
                idPasoDestino: resultado.NuevoIdPaso,
                idUsuarioActual: idUsuario,
                comentario: request.Comentario,
                contenidoAdicionalHtml: null);

            var nuevoEstado = await _context.WorkflowEstados.FindAsync(s.IdEstado);
            EnrichWideEvent("Firmar", entityId: idSolicitud, nombre: s.Folio,
                additionalContext: new Dictionary<string, object>
                {
                    ["estadoAnterior"] = s.Estado?.Codigo,
                    ["nuevoEstado"] = nuevoEstado?.Codigo,
                    ["idAccion"] = request.IdAccion
                });

            return new FirmarResponse
            {
                Exitoso = true,
                Folio = s.Folio,
                EstadoAnterior = s.Estado?.Codigo,
                NuevoEstado = nuevoEstado?.Codigo,
                Mensaje = $"Acción ejecutada exitosamente. Estado: {nuevoEstado?.Codigo}"
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("Firmar", entityId: idSolicitud, exception: ex);
            return CommonErrors.InternalServerError("Error inesperado al procesar la firma.");
        }
    }

    public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idSolicitud, int idUsuario)
    {
        var s = await _context.SolicitudesPersonal
            .FirstOrDefaultAsync(x => x.IdSolicitud == idSolicitud);
        if (s is null)
            return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

        if (!s.IdPasoActual.HasValue)
            return CommonErrors.Conflict("solicitud", "La solicitud no tiene paso actual.");

        return await _queryService.GetAccionesDisponiblesAsync(
            idWorkflow: s.IdWorkflow,
            idEntidad: s.IdSolicitud,
            idPasoActual: s.IdPasoActual.Value,
            idUsuario: idUsuario,
            tipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
            entidadParaHandlers: s);
    }

    public async Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idSolicitud, int idAccion, int idUsuario)
    {
        var s = await _context.SolicitudesPersonal
            .FirstOrDefaultAsync(x => x.IdSolicitud == idSolicitud);
        if (s is null)
            return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

        if (!s.IdPasoActual.HasValue)
            return CommonErrors.Conflict("solicitud", "La solicitud no tiene paso actual.");

        return await _queryService.GetAccionMetadataAsync(
            idWorkflow: s.IdWorkflow,
            idPasoActual: s.IdPasoActual.Value,
            idAccion: idAccion,
            idEntidad: s.IdSolicitud);
    }

    public Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idSolicitud)
        => _queryService.GetHistorialWorkflowAsync(idSolicitud, CodigoProceso.SOLICITUD_PERSONAL);

    private async Task<Dictionary<string, string>> ConstruirVariablesNotificacionAsync(SolicitudPersonal s)
    {
        var tipo = await _context.TiposSolicitud.FindAsync(s.IdTipoSolicitud);
        return new Dictionary<string, string>
        {
            ["TipoSolicitud"] = tipo?.Nombre ?? "",
            ["Categoria"] = tipo?.Categoria.ToString() ?? "",
            ["Motivo"] = s.Motivo ?? "",
            ["FechaInicio"] = s.FechaInicio?.ToString("yyyy-MM-dd") ?? "",
            ["FechaFin"] = s.FechaFin?.ToString("yyyy-MM-dd") ?? "",
            ["DiasSolicitados"] = s.DiasSolicitados?.ToString() ?? "",
            ["LugarComision"] = s.LugarComision ?? ""
        };
    }
}
```

### E.3 Reducir `SolicitudesPersonalService`

`SolicitudesPersonalService` se queda con solo CRUD + creación de solicitudes (sin FirmarAsync):

```csharp
public class SolicitudesPersonalService
{
    // Métodos que se quedan:
    Task<ErrorOr<SolicitudPersonalDto>> CrearAsync(...);
    Task<ErrorOr<SolicitudPersonalDto>> GetByIdAsync(int id);
    Task<List<SolicitudPersonalDto>> ListarAsync(...);
    Task<List<TipoSolicitudResponse>> ListarTiposAsync();
    
    // Métodos que se ELIMINAN (movidos a SolicitudPersonalFirmasService):
    // - FirmarAsync
    // - GetAccionesDisponiblesAsync
    // - GetHistorialAsync
    
    // Helpers privados que se quedan:
    // - GenerarFolioAsync
    // - MapToDto
}
```

---

## Fase F: Actualizar controllers

### F.1 `Features/OrdenesCompra/OrdenesCompraController.cs`

Agregar los endpoints de workflow (antes en `FirmasController`):

```csharp
[ApiController]
[Route("api/ordenes")]
[EndpointGroupName("OrdenesCompra")]
public class OrdenesCompraController : ControllerBase
{
    private readonly IOrdenCompraService _service;
    private readonly IOrdenCompraFirmasService _firmasService;
    private readonly int _userId;

    public OrdenesCompraController(
        IOrdenCompraService service,
        IOrdenCompraFirmasService firmasService,
        IHttpContextAccessor httpContextAccessor)
    {
        _service = service;
        _firmasService = firmasService;
        _userId = int.Parse(httpContextAccessor.HttpContext!.User.FindFirst("IdUsuario")!.Value);
    }

    // ... endpoints existentes de CRUD ...

    [HttpPost("{id}/firmar")]
    [SwaggerOperation(Summary = "Ejecutar acción de firma sobre una orden")]
    public async Task<IActionResult> Firmar(int id, [FromBody] FirmarRequest request)
    {
        var result = await _firmasService.FirmarAsync(id, request, _userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<FirmarResponse>
        { Success = true, Message = data?.Mensaje ?? "", Data = data }));
    }

    [HttpGet("{id}/acciones-disponibles")]
    [SwaggerOperation(Summary = "Obtener acciones disponibles para una orden según su estado actual")]
    public async Task<IActionResult> GetAccionesDisponibles(int id)
    {
        var orden = await _service.GetByIdAsync(id);  // Validar existencia
        if (orden.IsError) return BadRequest(orden.Errors);
        
        var result = await _firmasService.GetAccionesDisponiblesAsync(id, _userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AccionDisponibleResponse>>
        { Success = true, Message = "Acciones obtenidas exitosamente.", Data = data }));
    }

    [HttpGet("{id}/acciones/{idAccion}/metadata")]
    [SwaggerOperation(Summary = "Obtener metadata de una acción para construir modal dinámico")]
    public async Task<IActionResult> GetAccionMetadata(int id, int idAccion)
    {
        var result = await _firmasService.GetAccionMetadataAsync(id, idAccion, _userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<AccionMetadataResponse>
        { Success = true, Message = "Metadata obtenida.", Data = data }));
    }

    [HttpGet("{id}/historial-workflow")]
    [SwaggerOperation(Summary = "Obtener historial de transiciones del workflow para una orden")]
    public async Task<IActionResult> GetHistorialWorkflow(int id)
    {
        var result = await _firmasService.GetHistorialWorkflowAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
        { Success = true, Message = "Historial obtenido.", Data = data }));
    }
}
```

### F.2 `Features/OrdenesCompra/Concentrados/ConcentradosController.cs`

```csharp
[ApiController]
[Route("api/ordenes")]
[EndpointGroupName("OrdenesCompra")]
public class ConcentradosController : ControllerBase
{
    private readonly IConcentradosService _service;
    private readonly int _userId;

    public ConcentradosController(IConcentradosService service, IHttpContextAccessor http)
    {
        _service = service;
        _userId = int.Parse(http.HttpContext!.User.FindFirst("IdUsuario")!.Value);
    }

    [HttpPost("envio-concentrado")]
    public async Task<IActionResult> EnvioConcentrado([FromBody] EnvioConcentradoRequest request)
    {
        var result = await _service.EnvioConcentradoAsync(request, _userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<EnvioConcentradoResponse>
        { Success = true, Message = $"{data?.Exitosas} orden(es) avanzadas.", Data = data }));
    }

    [HttpPost("envio-concentrado-con-pdf")]
    public async Task<IActionResult> EnvioConcentradoConPdf([FromForm] EnvioConcentradoConPdfRequest request)
    {
        var result = await _service.EnvioConcentradoConPdfAsync(request, _userId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<EnvioConcentradoResponse>
        { Success = true, Message = "OK", Data = data }));
    }
}

[ApiController]
[Route("api/ordenes/externo")]
[EndpointGroupName("OrdenesCompra")]
public class ConcentradosExternoController : ControllerBase
{
    private readonly IConcentradosService _service;
    public ConcentradosExternoController(IConcentradosService service) => _service = service;

    [HttpPost("respuesta-concentrado")]
    public async Task<IActionResult> RespuestaConcentrado([FromBody] RespuestaConcentradoExternoRequest request)
    {
        var result = await _service.ProcesarRespuestaConcentradoAsync(request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<RespuestaConcentradoResponse>
        { Success = true, Message = "OK", Data = data }));
    }
}
```

### F.3 `Features/Rh/SolicitudesPersonal/SolicitudesPersonalController.cs`

```csharp
[ApiController]
[Route("api/solicitudes-personal")]
[Authorize]
public class SolicitudesPersonalController : ControllerBase
{
    private readonly SolicitudesPersonalService _service;          // CRUD
    private readonly ISolicitudPersonalFirmasService _firmasService;  // Firmas

    private int CurrentUserId => int.Parse(User.FindFirst("IdUsuario")!.Value);

    // Endpoints de CRUD (sin cambios)
    [HttpGet] public async Task<IActionResult> Listar(...) { ... }
    [HttpGet("{id}")] public async Task<IActionResult> GetById(int id) { ... }
    [HttpPost] public async Task<IActionResult> Crear([FromBody] CrearSolicitudPersonalRequest req) { ... }
    [HttpGet("tipos-solicitud")] public async Task<IActionResult> ListarTipos() { ... }

    // ★ NUEVO: endpoint renombrado de /acciones a /firmar
    [HttpPost("{id}/firmar")]
    [SwaggerOperation(Summary = "Ejecutar acción de workflow sobre una solicitud")]
    public async Task<IActionResult> Firmar(int id, [FromBody] FirmarRequest request)
    {
        var result = await _firmasService.FirmarAsync(id, request, CurrentUserId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<FirmarResponse>
        { Success = true, Message = data?.Mensaje ?? "", Data = data }));
    }

    [HttpGet("{id}/acciones-disponibles")]
    public async Task<IActionResult> GetAccionesDisponibles(int id)
    {
        var result = await _firmasService.GetAccionesDisponiblesAsync(id, CurrentUserId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AccionDisponibleResponse>>
        { Success = true, Message = "Acciones obtenidas.", Data = data }));
    }

    [HttpGet("{id}/acciones/{idAccion}/metadata")]
    public async Task<IActionResult> GetAccionMetadata(int id, int idAccion)
    {
        var result = await _firmasService.GetAccionMetadataAsync(id, idAccion, CurrentUserId);
        return result.ToActionResult(this, data => Ok(new ApiResponse<AccionMetadataResponse>
        { Success = true, Message = "OK", Data = data }));
    }

    [HttpGet("{id}/historial")]
    public async Task<IActionResult> GetHistorial(int id)
    {
        var result = await _firmasService.GetHistorialAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
        { Success = true, Message = "OK", Data = data }));
    }
}
```

### F.4 Eliminar controllers obsoletos

```bash
rm Features/OrdenesCompra/Firmas/FirmasController.cs
rm Features/OrdenesCompra/Firmas/FirmaExternoController.cs
```

---

## Fase G: Registrar DI y actualizar referencias

### G.1 `Program.cs`

```csharp
// Quitar (si existe)
builder.Services.AddScoped<IFirmasService, FirmasService>();

// Agregar
builder.Services.AddScoped<IWorkflowQueryService, WorkflowQueryService>();
builder.Services.AddScoped<IOrdenCompraFirmasService, OrdenCompraFirmasService>();
builder.Services.AddScoped<IConcentradosService, ConcentradosService>();
builder.Services.AddScoped<ISolicitudPersonalFirmasService, SolicitudPersonalFirmasService>();
```

### G.2 Actualizar imports en archivos que usaban los DTOs de OC

```bash
# Buscar y reemplazar
grep -rln "Features.OrdenesCompra.Firmas.DTOs" lefarma.backend/src/
```

Cambiar a:
- `FirmarRequest`, `FirmarResponse`, `AccionDisponibleResponse`, `AccionMetadataResponse`, `HistorialWorkflowItemResponse`, `AccionHandlerMetadataResponse`, `WorkflowCampoMetadataResponse` → `Lefarma.API.Features.Config.Workflows.DTOs`
- `EnvioConcentradoRequest`, `EnvioConcentradoResponse`, etc. → `Lefarma.API.Features.OrdenesCompra.Concentrados.DTOs`

### G.3 Actualizar tests

Cualquier test que importaba `IFirmasService` ahora importa `IOrdenCompraFirmasService`.

---

## Resumen de archivos

### Nuevos (8 archivos)

| Archivo | Propósito |
|---|---|
| `Features/Config/Workflows/IWorkflowQueryService.cs` | Interface queries genéricas |
| `Features/Config/Workflows/WorkflowQueryService.cs` | Implementación queries genéricas (~250 líneas) |
| `Features/Config/Workflows/WorkflowFirmaHelper.cs` | Helpers estáticos (validar participante, dispatch fire-and-forget) |
| `Features/Config/Workflows/DTOs/WorkflowAccionDTOs.cs` | DTOs compartidos |
| `Features/OrdenesCompra/Concentrados/ConcentradosService.cs` | Lógica de envío concentrado |
| `Features/OrdenesCompra/Concentrados/IConcentradosService.cs` | Interface |
| `Features/OrdenesCompra/Concentrados/ConcentradosController.cs` | Endpoints concentrados |
| `Features/Rh/SolicitudesPersonal/SolicitudPersonalFirmasService.cs` | Firma de solicitudes (~250 líneas) |
| `Features/Rh/SolicitudesPersonal/ISolicitudPersonalFirmasService.cs` | Interface |

### Renombrados (2 archivos)

| Antes | Después |
|---|---|
| `Firmas/FirmasService.cs` | `Firmas/OrdenCompraFirmasService.cs` |
| `Firmas/IFirmasService.cs` | `Firmas/IOrdenCompraFirmasService.cs` |

### Eliminados (4 archivos)

| Archivo | Razón |
|---|---|
| `Firmas/FirmasController.cs` | Rutas se mueven a `OrdenesCompraController` |
| `Firmas/FirmaExternoController.cs` | Rutas se mueven a `ConcentradosExternoController` |
| `Firmas/DTOs/FirmasDTOs.cs` | DTOs se mueven a `WorkflowAccionDTOs.cs` o `ConcentradosDTOs.cs` |
| (varios) | FirmasService queda con ~400 líneas (era 1,133) |

### Modificados (4 archivos)

| Archivo | Cambio |
|---|---|
| `SolicitudesPersonalService.cs` | Quitar `FirmarAsync`, `GetAccionesDisponiblesAsync`, `GetHistorialAsync` |
| `SolicitudesPersonalController.cs` | Cambiar `/acciones` → `/firmar`, inyectar `ISolicitudPersonalFirmasService` |
| `OrdenesCompraController.cs` | Agregar endpoints de workflow |
| `Program.cs` | Actualizar registros de DI |

---

## Orden de implementación

1. **Fase A** — Extraer DTOs compartidos
2. **Fase B** — Crear `WorkflowQueryService` (sin afectar nada existente)
3. **Fase C** — Crear `WorkflowFirmaHelper` (sin afectar nada existente)
4. **Fase D** — Refactor `FirmasService` → `OrdenCompraFirmasService`
5. **Fase E** — Crear `SolicitudPersonalFirmasService`
6. **Fase F** — Actualizar controllers
7. **Fase G** — Registrar DI, actualizar tests, eliminar archivos obsoletos

**Compilación incremental**: Después de cada fase, `dotnet build` debe pasar (excepto Fase G donde se hace la limpieza final).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper OC al refactorizar `FirmasService` | Mantener firma de `FirmarAsync` idéntica — solo extraer lógica |
| Renombrar DTOs rompe JSON del frontend | Hacer búsqueda exhaustiva de referencias; renombrar `IdOrden` → `IdEntidad` en DTOs solo si frontend no lo usa |
| Eliminar `FirmasController` rompe rutas | Verificar que las rutas `/api/ordenes/{id}/firmar` se preserven en `OrdenesCompraController` |
| Helper estático pierde testabilidad | Los helpers son pura lógica de delegación; los tests pueden probar `_engine` + `_context` directamente sin helper |
| `WorkflowContext` aún tiene `Orden` hardcoded (línea 22 de `IWorkflowEngine.cs`) | Marcar como siguiente iteración; pasar `null` para SP por ahora |
