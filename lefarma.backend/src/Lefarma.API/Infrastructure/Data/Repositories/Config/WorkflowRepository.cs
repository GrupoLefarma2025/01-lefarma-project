using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Config
{
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
                        .ThenInclude(a => a.Notificaciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Condiciones)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.CodigoProceso == codigoProceso && w.Activo);

        public async Task<WorkflowPaso?> GetPasoByCodigoEstadoAsync(int idWorkflow, string codigoEstado)
            => await _context.WorkflowPasos
                .FirstOrDefaultAsync(p => p.IdWorkflow == idWorkflow && p.CodigoEstado == codigoEstado);

        public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(int idPaso)
            => await _context.WorkflowAcciones
                .Where(a => a.IdPasoOrigen == idPaso)
                .ToListAsync();
    }
}
