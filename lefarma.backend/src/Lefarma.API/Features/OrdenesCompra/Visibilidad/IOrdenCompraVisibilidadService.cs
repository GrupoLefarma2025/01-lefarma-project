using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Visibilidad;

/// <summary>
/// Única política de visibilidad de las órdenes de compra. La usan la bandeja,
/// el detalle, las acciones, el historial de workflow y las firmas de bitácora.
/// </summary>
public interface IOrdenCompraVisibilidadService
{
    /// <summary>Resuelve permisos, roles, empresas, flujos, pasos y jefes del usuario.</summary>
    Task<AlcanceOrdenCompra> ResolverAsync(int idUsuario, CancellationToken ct = default);

    /// <summary>Aplica el alcance a una consulta de órdenes (sin filtrar por VerTodas).</summary>
    IQueryable<OrdenCompra> Aplicar(IQueryable<OrdenCompra> query, AlcanceOrdenCompra alcance);

    /// <summary>Indica si el usuario puede ver una orden concreta. Falso si no existe.</summary>
    Task<bool> PuedeVerAsync(int idOrden, int idUsuario, CancellationToken ct = default);
}
