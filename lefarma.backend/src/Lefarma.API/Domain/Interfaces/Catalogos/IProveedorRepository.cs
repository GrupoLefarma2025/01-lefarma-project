using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces;

namespace Lefarma.API.Domain.Interfaces.Catalogos;

public interface IProveedorRepository : IBaseRepository<Proveedor>
{
    Task<Proveedor?> GetByIdWithDetailsAsync(int id);
    void RemoveCuenta(ProveedorFormaPagoCuenta cuenta);
}
