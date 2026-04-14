using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Config {
public class WorkflowRepository : BaseRepository<Workflow>, IWorkflowRepository
    {
        private readonly ApplicationDbContext _context;

        public WorkflowRepository(ApplicationDbContext context) : base(context)
        {
            _context = context;
        }

        public async Task<Workflow?> GetByCodigoProcesoAsync(string codigoProceso)
            => await _context.Workflows
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.AccionHandlers)
                            .ThenInclude(h => h.Campo)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.Notificaciones)
                            .ThenInclude(n => n.Canales)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .Include(w => w.Campos)
                .FirstOrDefaultAsync(w => w.CodigoProceso == codigoProceso && w.Activo);

        public async Task<WorkflowPaso?> GetPasoByCodigoEstadoAsync(int idWorkflow, string codigoEstado)
            => await _context.WorkflowPasos
                .FirstOrDefaultAsync(p => p.IdWorkflow == idWorkflow && p.CodigoEstado == codigoEstado);

        public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(int idPaso)
            => await _context.WorkflowAcciones
                .Where(a => a.IdPasoOrigen == idPaso && a.Activo)
                .ToListAsync();

        public async Task<ICollection<WorkflowAccionHandler>> GetAccionHandlersAsync(int idAccion)
            => await _context.WorkflowAccionHandlers
                .Include(h => h.Campo)
                .Where(h => h.IdAccion == idAccion && h.Activo)
                .OrderBy(h => h.OrdenEjecucion)
                .ToListAsync();

        public async Task<ICollection<WorkflowCampo>> GetCamposByWorkflowAsync(int idWorkflow)
            => await _context.WorkflowCampos
                .Where(c => c.IdWorkflow == idWorkflow && c.Activo)
                .OrderBy(c => c.EtiquetaUsuario)
                .ToListAsync();

        public async Task<ICollection<WorkflowCanalTemplate>> GetCanalTemplatesAsync(int idWorkflow)
            => await _context.WorkflowCanalTemplates
                .Where(t => t.IdWorkflow == idWorkflow)
                .OrderBy(t => t.CodigoCanal)
                .ToListAsync();

        public async Task<WorkflowCanalTemplate?> GetCanalTemplateAsync(int idWorkflow, string codigoCanal)
            => await _context.WorkflowCanalTemplates
                .FirstOrDefaultAsync(t => t.IdWorkflow == idWorkflow && t.CodigoCanal == codigoCanal);
    }
}
