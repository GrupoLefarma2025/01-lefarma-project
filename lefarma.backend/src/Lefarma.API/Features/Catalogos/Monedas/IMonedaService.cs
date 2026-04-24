using ErrorOr;
using Lefarma.API.Features.Catalogos.Monedas.DTOs;

namespace Lefarma.API.Features.Catalogos.Monedas;

public interface IMonedaService
{
    Task<ErrorOr<IEnumerable<MonedaResponse>>> GetAllActivasAsync();
}
