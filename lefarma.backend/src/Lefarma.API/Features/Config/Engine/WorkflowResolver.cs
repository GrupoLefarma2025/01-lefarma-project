using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Engine
{
    public class WorkflowResolver : IWorkflowResolver
    {
        private readonly ApplicationDbContext _context;
        private readonly IWorkflowRepository _workflowRepo;

        public WorkflowResolver(ApplicationDbContext context, IWorkflowRepository workflowRepo)
        {
            _context = context;
            _workflowRepo = workflowRepo;
        }

        public async Task<Workflow?> ResolveWorkflowIdAsync(
            string codigoProceso,
            Dictionary<string, int?> context)
        {
            if (string.IsNullOrWhiteSpace(codigoProceso))
                return null;

            var scopeTypes = await _context.Set<WorkflowScopeType>()
                .Where(s => s.Activo)
                .OrderBy(s => s.NivelPrioridad)
                .ToListAsync();

            var mappings = await _context.Set<WorkflowMapping>()
                .Include(m => m.Workflow)
                    .ThenInclude(w => w.Pasos)
                        .ThenInclude(p => p.AccionesOrigen)
                            .ThenInclude(a => a.TipoAccion)
                .Where(m => m.CodigoProceso == codigoProceso && m.Activo && m.Workflow.Activo)
                .ToListAsync();

            foreach (var scopeType in scopeTypes)
            {
                var code = scopeType.Codigo?.ToUpperInvariant();
                if (code == null || !context.TryGetValue(code, out var targetId))
                    continue;

                if (targetId is null)
                    continue;

                var selectedMapping = mappings
                    .Where(m => m.IdScopeType == scopeType.IdScopeType && m.ScopeId == targetId)
                    .OrderBy(m => m.PrioridadManual)
                    .ThenByDescending(m => m.FechaCreacion)
                    .FirstOrDefault();

                if (selectedMapping?.Workflow != null)
                    return selectedMapping.Workflow;
            }

            return await _workflowRepo.GetByCodigoProcesoAsync(codigoProceso);
        }
    }
}