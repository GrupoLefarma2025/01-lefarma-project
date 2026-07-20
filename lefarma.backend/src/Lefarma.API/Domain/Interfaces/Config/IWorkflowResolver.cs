using Lefarma.API.Domain.Entities.Config;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowResolver
    {
        /// <summary>
        /// Resuelve el workflow activo para un proceso dado.
        /// Las claves del diccionario deben coincidir con el codigo de los scope types definidos en config.workflow_scope_types
        /// </summary>
        Task<Workflow?> ResolveWorkflowIdAsync(string codigoProceso, Dictionary<string, int?> context);
    }
}
