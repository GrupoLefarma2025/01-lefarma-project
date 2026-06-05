using Lefarma.API.Domain.Entities.Config;
using System.Threading.Tasks;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowResolver
    {
        Task<Workflow?> ResolveWorkflowIdAsync(string codigoProceso, int? idUsuario = null, int? idEmpresa = null, int? idSucursal = null, int? idArea = null, int? idTipoGasto = null, int? idProveedor = null);
    }
}
