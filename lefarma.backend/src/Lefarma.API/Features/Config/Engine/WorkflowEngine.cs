using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Config.Engine
{
    public class WorkflowEngine : IWorkflowEngine
    {
        private readonly IWorkflowRepository _workflowRepo;
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        private readonly IServiceProvider _serviceProvider;
        private readonly IJefeInmediatoResolver _jefeInmediatoResolver;

        public WorkflowEngine(
            IWorkflowRepository workflowRepo,
            ApplicationDbContext context,
            AsokamDbContext asokamcontext,
            IServiceProvider serviceProvider,
            IJefeInmediatoResolver jefeInmediatoResolver)
        {
            _workflowRepo = workflowRepo;
            _context = context;
            _asokamContext = asokamcontext;
            _serviceProvider = serviceProvider;
            _jefeInmediatoResolver = jefeInmediatoResolver;
        }

        public async Task<WorkflowEjecucionResult> EjecutarAccionAsync(WorkflowContext ctx)
        {
            var workflow = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.AccionHandlers)
                            .ThenInclude(h => h.Campo)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.TipoAccion)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.IdWorkflow == ctx.Entidad.IdWorkflow);
            if (workflow is null)
                return new WorkflowEjecucionResult(false, $"Workflow '{ctx.Entidad.IdWorkflow}' no encontrado.", null, null);

            var pasoActual = workflow.Pasos
                .FirstOrDefault(p => p.IdPaso == ctx.Entidad.IdPasoActual && p.Activo);

            if (pasoActual is null)
                return new WorkflowEjecucionResult(false, "El paso actual de la orden no es válido para el workflow.", null, null);

            // Validar que el usuario puede ejecutar acciones en este paso
            var esParticipante = await IsUsuarioParticipanteAsync(pasoActual, ctx.IdUsuario, ctx.Entidad.IdUsuarioCreador);
            var esCreador = ctx.IdUsuario == ctx.Entidad.IdUsuarioCreador;

            var accion = pasoActual.AccionesOrigen
                .FirstOrDefault(a => a.IdAccion == ctx.IdAccion && a.Activo);

            var esAccionCancelar = accion?.TipoAccion?.Codigo == "CANCELAR";
            var puedeComoCreador = esCreador && esAccionCancelar;

            if (!esParticipante && !puedeComoCreador)
                return new WorkflowEjecucionResult(false, "No eres participante de este paso del workflow.", null, null);

            if (pasoActual.RequiereComentario && string.IsNullOrWhiteSpace(ctx.Comentario))
                return new WorkflowEjecucionResult(false, "El comentario es obligatorio en este paso.", null, null);

            if (accion is null)
                return new WorkflowEjecucionResult(false, "Acción no válida para el estado actual.", null, null);

            var actionHandlers = accion.AccionHandlers
                .Where(h => h.Activo)
                .OrderBy(h => h.OrdenEjecucion)
                .ToList();

            if (actionHandlers.Any())
            {
                var handlerContext = new WorkflowHandlerContext(
                    Entidad: ctx.Entidad,
                    IdEntidad: ctx.IdEntidad,
                    TipoEntidad: ctx.TipoEntidad,
                    IdAccion: ctx.IdAccion,
                    IdUsuario: ctx.IdUsuario,
                    Comentario: ctx.Comentario,
                    DatosAdicionales: ctx.DatosAdicionales);

                foreach (var configured in actionHandlers)
                {
                    var actionHandler = _serviceProvider.GetKeyedService<IWorkflowActionHandler>(configured.HandlerKey);
                    if (actionHandler is null)
                        return new WorkflowEjecucionResult(false, $"Handler '{configured.HandlerKey}' no está registrado.", null, null);
                    
                    if (!actionHandler.TiposEntidadCompatibles.Contains("ALL") && !actionHandler.TiposEntidadCompatibles.Contains(ctx.TipoEntidad))
                        return new WorkflowEjecucionResult(false,
                            $"Handler '{configured.HandlerKey}' no es compatible con '{ctx.TipoEntidad}'.", null, null);

                    var result = await actionHandler.ProcessAsync(
                        handlerContext with { Handler = configured },
                        configured.ConfiguracionJson);
                    if (!result.Exitoso)
                        return new WorkflowEjecucionResult(false, result.Error ?? $"Error en handler '{configured.HandlerKey}'.", null, null);
                }
            }

            // Evaluar condiciones dinámicas (ej: Total > 100,000 → desviar a Firma 5)
            int? idPasoDestino = accion.IdPasoDestino;
            foreach (var condicion in accion.Condiciones.Where(c => c.Activo))
            {
                if (EvaluarCondicion(condicion, ctx))
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
                TipoEntidad = ctx.TipoEntidad,
                IdEntidad = ctx.IdEntidad,
                IdOrden = ctx.TipoEntidad == CodigoProceso.ORDEN_COMPRA ? ctx.IdEntidad : null, // Se mantiene para no romper compatibilidad con bitácora existente de órdenes
                IdWorkflow = workflow.IdWorkflow,
                IdPaso = nuevoPaso?.IdPaso ?? accion.PasoOrigen.IdPaso,
                IdAccion = accion.IdAccion,
                IdUsuario = ctx.IdUsuario,
                Comentario = ctx.Comentario,
                DatosSnapshot = System.Text.Json.JsonSerializer.Serialize(snapshot),
                FechaEvento = DateTime.Now
            });
            await _context.SaveChangesAsync();

            // Si la acción requiere envío concentrado, comunicar con sistema externo
            if (accion.EnviaConcentrado)
            {
                Console.WriteLine($"[EnvioConcentrado] Entidad {ctx.IdEntidad} #{ctx.IdEntidad} - Acción {accion.IdAccion} requiere envío concentrado. Comunicando con sistema externo");
            }

            return new WorkflowEjecucionResult(
                Exitoso: true,
                Error: null,
                NuevoIdPaso: nuevoPaso?.IdPaso,
                NuevoIdEstado: nuevoPaso?.IdEstado
            );
        }


        public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(
            int idWorkflow, int idEntidad, int idUsuario, string tipoEntidad)
        {
            // Resolver el contexto de la entidad segun tipo
            var entityContext = await ResolveEntityContextAsync(tipoEntidad, idEntidad);
            if (entityContext?.IdPasoActual is null) return Array.Empty<WorkflowAccion>();

            // Validar que el idWorkflow guardado en la entidad coincida
            if (entityContext.IdWorkflow != idWorkflow)
                return Array.Empty<WorkflowAccion>();

            // Cargar workflow con pasos, acciones y participantes por el idWorkflow
            var workflow = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

            return await ResolveAccionesAsync(entityContext.IdPasoActual.Value, workflow, idUsuario, entityContext.IdUsuarioCreador);
        }

        private async Task<ICollection<WorkflowAccion>> ResolveAccionesAsync(int idPasoActual, Workflow? workflow, int idUsuario, int idUsuarioCreador)
        {
            var acciones = await _workflowRepo.GetAccionesDisponiblesAsync(idPasoActual);
            var pasoActual = workflow?.Pasos.FirstOrDefault(p => p.IdPaso == idPasoActual);
            if (pasoActual is null || !pasoActual.Activo) return Array.Empty<WorkflowAccion>();

            var esParticipante = await IsUsuarioParticipanteAsync(pasoActual, idUsuario, idUsuarioCreador);
            var esCreador = idUsuario == idUsuarioCreador;
            var tieneAccionCancelar = pasoActual.AccionesOrigen
                .Any(a => a.Activo && a.TipoAccion != null && a.TipoAccion.Codigo == "CANCELAR");

            // Si no es participante ni creador con acción cancelar, no hay acciones disponibles
            if (!esParticipante && !(esCreador && tieneAccionCancelar))
                return Array.Empty<WorkflowAccion>();

            IEnumerable<WorkflowAccion> accionesFiltradas = acciones;

            if (esCreador && esParticipante)
            {
                // El creador también es participante formal: ve todas las acciones
                accionesFiltradas = acciones;
            }
            else if (esCreador && tieneAccionCancelar)
            {
                // El creador no es participante: solo ve acciones CANCELAR
                accionesFiltradas = acciones.Where(a => a.TipoAccion != null && a.TipoAccion.Codigo == "CANCELAR");
            }
            else if (esParticipante)
            {
                // Participante formal: ve todas las acciones excepto CANCELAR
                accionesFiltradas = acciones.Where(a => a.TipoAccion == null || a.TipoAccion.Codigo != "CANCELAR");
            }
            else
            {
                return Array.Empty<WorkflowAccion>();
            }

            var accionesResult = accionesFiltradas.ToList();

            // Algun accion del paso tiene condiciones de enrutamiento
            if (pasoActual.AccionesOrigen.Any(a => a.Condiciones.Any()))
            {
                var aprobaciones = accionesResult
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

                    var restantes = accionesResult
                        .Where(a => a.TipoAccion == null || a.TipoAccion.Codigo != "APROBAR")
                        .OrderBy(a => a.IdAccion)
                        .ToList();

                    return new List<WorkflowAccion> { autorizacionUnica }
                        .Concat(restantes)
                        .ToList();
                }
            }

            return accionesResult;
        }

        private async Task<bool> IsUsuarioParticipanteAsync(WorkflowPaso paso, int idUsuario, int idUsuarioCreador)
        {
            // Si es el paso inicial, el creador de la orden siempre puede ejecutar acciones
            if (paso.EsInicio && idUsuario == idUsuarioCreador)
                return true;

            var participantes = paso.Participantes.Where(p => p.Activo).ToList();
            if (!participantes.Any()) return true; // Si no hay participantes definidos, permitir a todos

            // Verificar asignación directa por usuario
            if (participantes.Any(p => p.IdUsuario == idUsuario))
                return true;

            // Verificar asignación por rol
            var rolesUsuario = await _asokamContext.UsuariosRoles
                .Where(ur => ur.IdUsuario == idUsuario && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow))
                .Select(ur => ur.IdRol)
                .ToListAsync();

            if (participantes.Any(p => p.IdRol.HasValue && rolesUsuario.Contains(p.IdRol.Value)))
                return true;

            // Verificar asignación por jefe inmediato
            if (participantes.Any(p => p.RequiereJefeInmediato))
            {
                var idJefe = await _jefeInmediatoResolver.ResolverIdUsuarioJefeAsync(idUsuarioCreador);
                if (idJefe.HasValue && idJefe.Value == idUsuario)
                    return true;
            }

            return false;
        }

        private async Task<WorkflowEntityContext> ResolveEntityContextAsync(string tipoEntidad, int idEntidad)
        {
            return tipoEntidad switch
            {
                CodigoProceso.ORDEN_COMPRA => await _context.OrdenesCompra
                    .Where(o => o.IdOrden == idEntidad)
                    .Select(o => new WorkflowEntityContext(
                        o.IdWorkflow, o.IdPasoActual, o.IdUsuarioCreador))
                    .FirstOrDefaultAsync() ?? new(0, null, 0),

                CodigoProceso.SOLICITUD_PERSONAL => await _context.SolicitudesPersonal
                    .Where(i => i.IdSolicitud == idEntidad)
                    .Select(i => new WorkflowEntityContext(
                        i.IdWorkflow, i.IdPasoActual, i.IdUsuarioCreador))
                    .FirstOrDefaultAsync() ?? new(0, null, 0),

                _ => throw new NotSupportedException(
                    $"TipoEntidad '{tipoEntidad}' no soportado por el engine.")
            };
        }
        private record WorkflowEntityContext(
            int IdWorkflow, int? IdPasoActual, int IdUsuarioCreador);

        private static bool EvaluarCondicion(WorkflowCondicion c, WorkflowContext ctx)
        {
            // Leer propiedad directa de OrdenCompra (IgnoreCase)
            var prop = ctx.Entidad.GetType().GetProperty(
                c.CampoEvaluacion,
                System.Reflection.BindingFlags.IgnoreCase | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);

            if (prop is null) return false;

            var propValue = prop.GetValue(ctx.Entidad);
            if (propValue is null) return false;

            // Booleanos: true/false
            if (c.Operador is "true" or "false")
            {
                var esVerdadero = propValue is bool b ? b : false;
                return c.Operador == "true" ? esVerdadero : !esVerdadero;
            }

            // Numéricos: >, >=, <, <=, =, !=
            if (decimal.TryParse(propValue.ToString(), out var v) &&
                decimal.TryParse(c.ValorComparacion, out var cmp))
            {
                return c.Operador switch
                {
                    ">"  => v > cmp,
                    ">=" => v >= cmp,
                    "<"  => v < cmp,
                    "<=" => v <= cmp,
                    "="  => v == cmp,
                    "!=" => v != cmp,
                    _    => false
                };
            }

            return false;
        }
    }
}
