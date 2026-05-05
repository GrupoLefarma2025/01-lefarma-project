using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
namespace Lefarma.API.Features.Config.Engine
{
    public class WorkflowEngine : IWorkflowEngine
    {
        private readonly IWorkflowRepository _workflowRepo;
        private readonly ApplicationDbContext _context;
        private readonly IServiceProvider _serviceProvider;

        public WorkflowEngine(
            IWorkflowRepository workflowRepo,
            ApplicationDbContext context,
            IServiceProvider serviceProvider)
        {
            _workflowRepo = workflowRepo;
            _context = context;
            _serviceProvider = serviceProvider;
        }

        public async Task<WorkflowEjecucionResult> EjecutarAccionAsync(WorkflowContext ctx)
        {
            var workflow = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.AccionHandlers)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.TipoAccion)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.IdWorkflow == ctx.Orden.IdWorkflow);
            if (workflow is null)
                return new WorkflowEjecucionResult(false, $"Workflow '{ctx.Orden.IdWorkflow}' no encontrado.", null, null);

            var pasoActual = workflow.Pasos
                .FirstOrDefault(p => p.IdPaso == ctx.Orden.IdPasoActual && p.Activo);

            if (pasoActual is null)
                return new WorkflowEjecucionResult(false, "El paso actual de la orden no es válido para el workflow.", null, null);

            // Validar que el usuario es participante del paso actual
            if (!await IsUsuarioParticipanteAsync(pasoActual, ctx.IdUsuario))
                return new WorkflowEjecucionResult(false, "No eres participante de este paso del workflow.", null, null);

            if (pasoActual.RequiereComentario && string.IsNullOrWhiteSpace(ctx.Comentario))
                return new WorkflowEjecucionResult(false, "El comentario es obligatorio en este paso.", null, null);

            var accion = pasoActual.AccionesOrigen
                .FirstOrDefault(a => a.IdAccion == ctx.IdAccion && a.Activo);

            if (accion is null)
                return new WorkflowEjecucionResult(false, "Acción no válida para el estado actual.", null, null);

            var actionHandlers = accion.AccionHandlers
                .Where(h => h.Activo)
                .OrderBy(h => h.OrdenEjecucion)
                .ToList();

            if (actionHandlers.Any())
            {
                var handlerContext = new WorkflowHandlerContext(
                    Orden: ctx.Orden,
                    IdOrden: ctx.IdOrden,
                    IdAccion: ctx.IdAccion,
                    IdUsuario: ctx.IdUsuario,
                    Comentario: ctx.Comentario,
                    DatosAdicionales: ctx.DatosAdicionales);

                foreach (var configured in actionHandlers)
                {
                    var actionHandler = _serviceProvider.GetKeyedService<IWorkflowActionHandler>(configured.HandlerKey);
                    if (actionHandler is null)
                        return new WorkflowEjecucionResult(false, $"Handler '{configured.HandlerKey}' no está registrado.", null, null);

                    var result = await actionHandler.ProcessAsync(
                        handlerContext with { Handler = configured },
                        configured.ConfiguracionJson);
                    if (!result.Exitoso)
                        return new WorkflowEjecucionResult(false, result.Error ?? $"Error en handler '{configured.HandlerKey}'.", null, null);
                }
            }

            // Evaluar condiciones dinámicas (ej: Total > 100,000 → desviar a Firma 5)
            int? idPasoDestino = accion.IdPasoDestino;
            foreach (var condicion in accion.PasoOrigen!.Condiciones.Where(c => c.Activo))
            {
                if (EvaluarCondicion(condicion, ctx.DatosAdicionales))
                {
                    idPasoDestino = condicion.IdPasoSiCumple;
                    break;
                }
            }

            var nuevoPaso = idPasoDestino.HasValue
                ? workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPasoDestino.Value && p.Activo)
                : null;

            // Registrar en bitácora inmutable la transición ejecutada
            var snapshot = new Dictionary<string, object?>
            {
                ["idWorkflow"] = workflow.IdWorkflow,
                ["idPasoAnterior"] = accion.PasoOrigen.IdPaso,
                ["idPasoNuevo"] = nuevoPaso?.IdPaso,
                ["idEstadoNuevo"] = nuevoPaso?.IdEstado,
                ["datosAdicionales"] = ctx.DatosAdicionales
            };

            _context.WorkflowBitacoras.Add(new WorkflowBitacora
            {
                IdOrden = ctx.IdOrden,
                IdWorkflow = workflow.IdWorkflow,
                IdPaso = nuevoPaso?.IdPaso ?? accion.PasoOrigen.IdPaso,
                IdAccion = accion.IdAccion,
                IdUsuario = ctx.IdUsuario,
                Comentario = ctx.Comentario,
                DatosSnapshot = System.Text.Json.JsonSerializer.Serialize(snapshot),
                FechaEvento = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            // Si la acción requiere envío concentrado, comunicar con sistema externo
            if (accion.EnviaConcentrado)
            {
                Console.WriteLine($"[EnvioConcentrado] Orden {ctx.IdOrden} - Acción {accion.IdAccion} requiere envío concentrado. Comunicando con sistema externo...");
                // TODO: Implementar llamada al endpoint del sistema externo
            }

            return new WorkflowEjecucionResult(
                Exitoso: true,
                Error: null,
                NuevoIdPaso: nuevoPaso?.IdPaso,
                NuevoIdEstado: nuevoPaso?.IdEstado
            );
        }

        public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(
            string codigoProceso, int idOrden, int idUsuario)
        {
            var orden = await _context.OrdenesCompra.FindAsync(idOrden);
            if (orden?.IdPasoActual is null) return Array.Empty<WorkflowAccion>();

            var workflow = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.CodigoProceso == codigoProceso);

            return await ResolveAccionesAsync(orden.IdPasoActual.Value, workflow, idUsuario);
        }

        public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(
            int idWorkflow, int idOrden, int idUsuario)
        {
            var orden = await _context.OrdenesCompra.FindAsync(idOrden);
            if (orden?.IdPasoActual is null) return Array.Empty<WorkflowAccion>();

            var workflow = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

            return await ResolveAccionesAsync(orden.IdPasoActual.Value, workflow, idUsuario);
        }

        private async Task<ICollection<WorkflowAccion>> ResolveAccionesAsync(int idPasoActual, Workflow? workflow, int idUsuario)
        {
            var acciones = await _workflowRepo.GetAccionesDisponiblesAsync(idPasoActual);
            var pasoActual = workflow?.Pasos.FirstOrDefault(p => p.IdPaso == idPasoActual);
            if (pasoActual is null || !pasoActual.Activo) return Array.Empty<WorkflowAccion>();

            // Validar que el usuario es participante del paso actual
            if (!await IsUsuarioParticipanteAsync(pasoActual, idUsuario))
                return Array.Empty<WorkflowAccion>();

            // Cuando el paso usa condiciones para enrutar la aprobación (ej. Firma 4 por monto),
            // se expone una sola acción "Autorizar" para evitar duplicados en UI.
            if (pasoActual.Condiciones.Any())
            {
                var aprobaciones = acciones
                    .Where(a => a.TipoAccion != null && a.TipoAccion.Codigo == "APROBAR")
                    .OrderBy(a => a.IdAccion)
                    .ToList();

                if (aprobaciones.Count > 1)
                {
                    var accionBase = aprobaciones.First();
                    var autorizacionUnica = new WorkflowAccion
                    {
                        IdAccion = accionBase.IdAccion,
                        IdPasoOrigen = accionBase.IdPasoOrigen,
                        IdPasoDestino = accionBase.IdPasoDestino,
                        IdTipoAccion = accionBase.IdTipoAccion
                    };

                    var restantes = acciones
                        .Where(a => a.TipoAccion == null || a.TipoAccion.Codigo != "APROBAR")
                        .OrderBy(a => a.IdAccion)
                        .ToList();

                    return new List<WorkflowAccion> { autorizacionUnica }
                        .Concat(restantes)
                        .ToList();
                }
            }

            return acciones;
        }

        private async Task<bool> IsUsuarioParticipanteAsync(WorkflowPaso paso, int idUsuario)
        {
            var participantes = paso.Participantes.Where(p => p.Activo).ToList();
            if (!participantes.Any()) return true; // Si no hay participantes definidos, permitir a todos

            // Verificar asignación directa por usuario
            if (participantes.Any(p => p.IdUsuario == idUsuario))
                return true;

            // Verificar asignación por rol
            var rolesUsuario = await _context.UsuariosRoles
                .Where(ur => ur.IdUsuario == idUsuario && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow))
                .Select(ur => ur.IdRol)
                .ToListAsync();

            return participantes.Any(p => p.IdRol.HasValue && rolesUsuario.Contains(p.IdRol.Value));
        }

        private static bool EvaluarCondicion(WorkflowCondicion c, Dictionary<string, object>? datos)
        {
            if (datos is null || !datos.TryGetValue(c.CampoEvaluacion, out var valor)) return false;
            if (!decimal.TryParse(valor.ToString(), out var v) ||
                !decimal.TryParse(c.ValorComparacion, out var cmp)) return false;

            return c.Operador switch
            {
                ">" => v > cmp,
                ">=" => v >= cmp,
                "<" => v < cmp,
                "<=" => v <= cmp,
                "=" => v == cmp,
                _ => false
            };
        }
    }
}
