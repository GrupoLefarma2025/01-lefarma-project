using Lefarma.API.Domain.Entities.Catalogos;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace Lefarma.API.Domain.Interfaces.Catalogos {
public interface IEmpresaRepository : IBaseRepository<Empresa>
    {
        // Métodos específicos para Empresa si es necesario
    }
}
