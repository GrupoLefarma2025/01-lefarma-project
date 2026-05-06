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
            int? idUsuario = null,
            int? idEmpresa = null,
            int? idSucursal = null,
            int? idArea = null,
            int? idTipoGasto = null,
            int? idProveedor = null
            )
        {
            // Obtener los tipos de scope activos ordenados por prioridad
            var scopeTypes = await _context.Set<WorkflowScopeType>()
                .Where(s => s.Activo)
                .OrderBy(s => s.NivelPrioridad)
                .ToListAsync();

            // Obtener los mappings activos para el proceso dado e incluimos el Workflow de una vez
            var mappings = await _context.Set<WorkflowMapping>()
                .Include(m => m.Workflow) // Carga rápida
                    .ThenInclude(w => w.Pasos)
                        .ThenInclude(p => p.AccionesOrigen)
                .Where(m => m.CodigoProceso == codigoProceso && m.Activo && m.Workflow.Activo)
                .ToListAsync();

            var contextMap = new Dictionary<string, int?>(StringComparer.OrdinalIgnoreCase)
            {
                ["USUARIO"] = idUsuario,
                ["EMPRESA"] = idEmpresa,
                ["SUCURSAL"] = idSucursal,
                ["AREA"] = idArea,
                ["TIPO_GASTO"] = idTipoGasto,
                ["PROVEEDOR"] = idProveedor,
                ["DEFAULT"] = null
            };

            // Iterar por los tipos de scope en orden de prioridad
            foreach (var scopeType in scopeTypes)
            {
                var code = scopeType.Codigo?.ToUpperInvariant();
                if (code == null || !contextMap.ContainsKey(code)) continue;
                // Obtener el valor del contexto para este tipo de scope
                int? targetId = contextMap[code];
                // Buscar match (específico o default del scope)
                var selectedMapping = mappings
                    .Where(m => m.IdScopeType == scopeType.IdScopeType && m.ScopeId == targetId)
                    .OrderBy(m => m.PrioridadManual)
                    .ThenByDescending(m => m.FechaCreacion)
                    .FirstOrDefault();
                if (selectedMapping?.Workflow != null)
                    return selectedMapping.Workflow;
            }

            // Si no se encuentra ningún mapping específico, buscar un mapping default sin importar el scope
            return await _workflowRepo.GetByCodigoProcesoAsync(codigoProceso);
        }
    }
}