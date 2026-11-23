using Lefarma.API.Domain.Entities.Config;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowResolver
    {
        Task<Workflow?> ResolveWorkflowIdAsync(string codigoProceso, Dictionary<string, int?> context);
    }
}
