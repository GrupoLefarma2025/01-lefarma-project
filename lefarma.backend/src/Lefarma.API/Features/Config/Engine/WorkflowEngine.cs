using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Infrastructure.Data;

namespace Lefarma.API.Features.Config.Engine
{
    public class WorkflowEngine : IWorkflowEngine
    {
        private readonly IWorkflowRepository _workflowRepo;
        private readonly ApplicationDbContext _context;

        public WorkflowEngine(IWorkflowRepository workflowRepo, ApplicationDbContext context)
        {
            _workflowRepo = workflowRepo;
            _context = context;
        }

        public async Task<WorkflowEjecucionResult> EjecutarAccionAsync(WorkflowContext ctx)
        {
            var workflow = await _workflowRepo.GetByCodigoProcesoAsync(ctx.CodigoProceso);
            if (workflow is null)
                return new WorkflowEjecucionResult(false, $"Workflow '{ctx.CodigoProceso}' no encontrado.", null, null);

            var accion = workflow.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == ctx.IdAccion && a.Activo);

            if (accion is null)
                return new WorkflowEjecucionResult(false, "Acción no válida para el estado actual.", null, null);

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
                ["idPasoAnterior"] = accion.PasoOrigen.IdPaso,
                ["idPasoNuevo"] = nuevoPaso?.IdPaso,
                ["codigoEstadoNuevo"] = nuevoPaso?.CodigoEstado,
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

            return new WorkflowEjecucionResult(
                Exitoso: true,
                Error: null,
                NuevoIdPaso: nuevoPaso?.IdPaso,
                NuevoCodigoEstado: nuevoPaso?.CodigoEstado
            );
        }

        public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(
            string codigoProceso, int idOrden, int idUsuario)
        {
            var orden = await _context.OrdenesCompra.FindAsync(idOrden);
            if (orden?.IdPasoActual is null) return Array.Empty<WorkflowAccion>();

            var acciones = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
            var workflow = await _workflowRepo.GetByCodigoProcesoAsync(codigoProceso);
            var pasoActual = workflow?.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual.Value);
            if (pasoActual is null || !pasoActual.Activo) return Array.Empty<WorkflowAccion>();

            // Cuando el paso usa condiciones para enrutar la aprobación (ej. Firma 4 por monto),
            // se expone una sola acción "Autorizar" para evitar duplicados en UI.
            if (pasoActual?.Condiciones.Any() == true)
            {
                var aprobaciones = acciones
                    .Where(a => a.TipoAccion == "APROBACION")
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
                        NombreAccion = "Autorizar",
                        TipoAccion = accionBase.TipoAccion,
                        ClaseEstetica = accionBase.ClaseEstetica
                    };

                    var restantes = acciones
                        .Where(a => a.TipoAccion != "APROBACION")
                        .OrderBy(a => a.IdAccion)
                        .ToList();

                    return new List<WorkflowAccion> { autorizacionUnica }
                        .Concat(restantes)
                        .ToList();
                }
            }

            return acciones;
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
