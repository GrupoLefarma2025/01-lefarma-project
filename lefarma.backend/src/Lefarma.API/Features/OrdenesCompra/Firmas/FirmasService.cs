using ErrorOr;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
using Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
public class FirmasService : BaseService, IFirmasService
    {
        private readonly IOrdenCompraRepository _ordenRepo;
        private readonly IWorkflowEngine _engine;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWorkflowRepository _workflowRepo;
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        protected override string EntityName => "Firma";

        private const string CODIGO_PROCESO = "ORDEN_COMPRA";

        public FirmasService(
            IOrdenCompraRepository ordenRepo,
            IWorkflowEngine engine,
            IWorkflowRepository workflowRepo,
            IServiceProvider serviceProvider,
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _ordenRepo = ordenRepo;
            _engine = engine;
            _workflowRepo = workflowRepo;
            _serviceProvider = serviceProvider;
            _context = context;
            _asokamContext = asokamContext;
        }

        public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idOrden, FirmarRequest request, int idUsuario)
        {
            try
            {
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                {
                    EnrichWideEvent("Firmar", entityId: idOrden, notFound: true);
                    return CommonErrors.NotFound("orden de compra", idOrden.ToString());
                }

                if (orden.Estado is EstadoOC.Cerrada or EstadoOC.Cancelada)
                    return CommonErrors.Conflict("OrdenCompra", $"La orden {orden.Folio} ya est� cerrada o cancelada.");

                // Cargar paso actual para verificar requisitos del paso
                WorkflowPasoInfo? pasoActual = null;
                var workflowConfig = await _workflowRepo.GetByCodigoProcesoAsync(CODIGO_PROCESO);
                if (orden.IdPasoActual.HasValue)
                {
                    var paso = workflowConfig?.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual.Value && p.Activo);
                    if (paso is not null)
                        pasoActual = new WorkflowPasoInfo(paso.RequiereComentario, paso.HandlerKey);
                }

                // Validar comentario obligatorio
                if (pasoActual?.RequiereComentario == true && string.IsNullOrWhiteSpace(request.Comentario))
                    return CommonErrors.Validation("Comentario", "El comentario es obligatorio en este paso.");

                // Ejecutar step handler espec�fico (Firma3Handler, Firma4Handler, etc.)
                if (!string.IsNullOrEmpty(pasoActual?.HandlerKey))
                {
                    var handler = _serviceProvider.GetKeyedService<IStepHandler>(pasoActual.HandlerKey);
                    if (handler is not null)
                    {
                        var error = await handler.ValidarAsync(orden, request.DatosAdicionales);
                        if (error is not null)
                            return CommonErrors.Validation(pasoActual.HandlerKey, error);

                        await handler.AplicarAsync(orden, request.DatosAdicionales);
                    }
                }

                var estadoAnterior = orden.Estado.ToString();

                // Construir contexto pasando el Total para que las condiciones puedan evaluarlo
                var datosAdicionales = request.DatosAdicionales ?? new Dictionary<string, object>();
                datosAdicionales["Total"] = orden.Total;

                // Ejecutar el motor de workflow
                var ctx = new WorkflowContext(
                    CodigoProceso: CODIGO_PROCESO,
                    IdOrden: idOrden,
                    IdAccion: request.IdAccion,
                    IdUsuario: idUsuario,
                    Comentario: request.Comentario,
                    DatosAdicionales: datosAdicionales
                );

                var resultado = await _engine.EjecutarAccionAsync(ctx);
                if (!resultado.Exitoso)
                    return CommonErrors.Conflict("Workflow", resultado.Error ?? "Error en el motor de workflow.");

                // Actualizar estado de la orden
                if (TryMapEstado(resultado.NuevoCodigoEstado, out var nuevoEstado))
                {
                    orden.Estado = nuevoEstado;
                    if (nuevoEstado == EstadoOC.Autorizada)
                        orden.FechaAutorizacion = DateTime.UtcNow;
                }

                orden.IdPasoActual = resultado.NuevoIdPaso;
                orden.FechaModificacion = DateTime.UtcNow;
                await _ordenRepo.UpdateAsync(orden);

                // Selecci�n de plantilla por destino: (id_accion + id_paso_destino) con fallback gen�rico.
                var notificacionSeleccionada = ResolveWorkflowNotification(workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

                EnrichWideEvent("Firmar", entityId: idOrden, nombre: orden.Folio,
                    additionalContext: new Dictionary<string, object>
                    {
                        ["estadoAnterior"] = estadoAnterior,
                        ["nuevoEstado"] = orden.Estado.ToString(),
                        ["idAccion"] = request.IdAccion,
                        ["idPasoDestino"] = resultado.NuevoIdPaso ?? 0,
                        ["idNotificacionSeleccionada"] = (object)(notificacionSeleccionada?.IdNotificacion ?? 0)
                    });

                return new FirmarResponse
                {
                    Exitoso = true,
                    Folio = orden.Folio,
                    EstadoAnterior = estadoAnterior,
                    NuevoEstado = orden.Estado.ToString(),
                    Mensaje = $"Acci�n ejecutada exitosamente. Estado: {orden.Estado}"
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Firmar", entityId: idOrden, exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al procesar la firma.");
            }
        }

        public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesAsync(int idOrden, int idUsuario)
        {
            try
            {
                var acciones = await _engine.GetAccionesDisponiblesAsync(CODIGO_PROCESO, idOrden, idUsuario);
                if (!acciones.Any())
                    return CommonErrors.NotFound("acciones disponibles");

                return acciones.Select(a => new AccionDisponibleResponse
                {
                    IdAccion = a.IdAccion,
                    NombreAccion = a.NombreAccion,
                    TipoAccion = a.TipoAccion,
                    ClaseEstetica = a.ClaseEstetica
                }).ToList();
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAcciones", entityId: idOrden, exception: ex);
                return CommonErrors.DatabaseError("obtener las acciones disponibles");
            }
        }

        public async Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(int idOrden)
        {
            try
            {
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                {
                    EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, notFound: true);
                    return CommonErrors.NotFound("orden de compra", idOrden.ToString());
                }

                var historial = await _context.WorkflowBitacoras
                    .AsNoTracking()
                    .Where(b => b.IdOrden == idOrden)
                    .OrderByDescending(b => b.FechaEvento)
                    .Select(b => new HistorialWorkflowItemResponse
                    {
                        IdEvento = b.IdEvento,
                        IdOrden = b.IdOrden,
                        IdPaso = b.IdPaso,
                        NombrePaso = b.Paso != null ? b.Paso.NombrePaso : null,
                        IdAccion = b.IdAccion,
                        NombreAccion = b.Accion != null ? b.Accion.NombreAccion : null,
                        IdUsuario = b.IdUsuario,
                        NombreUsuario = null,
                        Comentario = b.Comentario,
                        DatosSnapshot = b.DatosSnapshot,
                        FechaEvento = b.FechaEvento
                    })
                    .ToListAsync();

                if (!historial.Any())
                {
                    EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, count: 0);
                    return CommonErrors.NotFound("historial de workflow");
                }

                var userIds = historial.Select(h => h.IdUsuario).Distinct().ToList();
                var userMap = await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .Select(u => new { u.IdUsuario, u.NombreCompleto })
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto);

                foreach (var item in historial)
                {
                    if (userMap.TryGetValue(item.IdUsuario, out var nombre))
                        item.NombreUsuario = nombre;
                }

                EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, count: historial.Count);
                return historial;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, exception: ex);
                return CommonErrors.DatabaseError("obtener historial de workflow");
            }
        }

        private static bool TryMapEstado(string? codigoEstado, out EstadoOC estado)
        {
            estado = default;
            if (string.IsNullOrWhiteSpace(codigoEstado))
                return false;

            if (Enum.TryParse<EstadoOC>(codigoEstado, ignoreCase: true, out estado))
                return true;

            return codigoEstado.Trim().ToUpperInvariant() switch
            {
                "CREADA" => (estado = EstadoOC.Creada) == EstadoOC.Creada,
                "EN_REVISION_F2" => (estado = EstadoOC.EnRevisionF2) == EstadoOC.EnRevisionF2,
                "EN_REVISION_F3" => (estado = EstadoOC.EnRevisionF3) == EstadoOC.EnRevisionF3,
                "EN_REVISION_F4" => (estado = EstadoOC.EnRevisionF4) == EstadoOC.EnRevisionF4,
                "EN_REVISION_F5" => (estado = EstadoOC.EnRevisionF5) == EstadoOC.EnRevisionF5,
                "AUTORIZADA" => (estado = EstadoOC.Autorizada) == EstadoOC.Autorizada,
                "EN_TESORERIA" => (estado = EstadoOC.EnTesoreria) == EstadoOC.EnTesoreria,
                "PAGADA" => (estado = EstadoOC.Pagada) == EstadoOC.Pagada,
                "EN_COMPROBACION" => (estado = EstadoOC.EnComprobacion) == EstadoOC.EnComprobacion,
                "CERRADA" => (estado = EstadoOC.Cerrada) == EstadoOC.Cerrada,
                "RECHAZADA" => (estado = EstadoOC.Rechazada) == EstadoOC.Rechazada,
                "CANCELADA" => (estado = EstadoOC.Cancelada) == EstadoOC.Cancelada,
                _ => false
            };
        }

        private static Domain.Entities.Config.WorkflowNotificacion? ResolveWorkflowNotification(
            Domain.Entities.Config.Workflow? workflow,
            int idAccion,
            int? idPasoDestino)
        {
            var accion = workflow?.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == idAccion && a.Activo);

            if (accion is null)
                return null;

            return accion.Notificaciones.FirstOrDefault(n => n.Activo && n.IdPasoDestino == idPasoDestino)
                ?? accion.Notificaciones.FirstOrDefault(n => n.Activo && n.IdPasoDestino == null);
        }

        // Record auxiliar interno
        private record WorkflowPasoInfo(bool RequiereComentario, string? HandlerKey);
    }
}
