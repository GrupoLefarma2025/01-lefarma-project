using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Domain.Interfaces.Operaciones;

public interface IComprobanteRepository : IBaseRepository<Comprobante>
{
    Task<Comprobante?> GetWithConceptosAsync(int idComprobante, CancellationToken ct = default);
    Task<bool> UuidExisteAsync(string uuid, CancellationToken ct = default);
    Task<IEnumerable<ComprobantePartida>> GetAsignacionesByPartidaAsync(int idPartida, CancellationToken ct = default);
}
