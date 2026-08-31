using Lefarma.API.Domain.ValueObjects.Config;

namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IJefeInmediatoResolver
    {
        Task<int?> ResolverIdUsuarioJefeAsync(int idUsuarioCreador, CancellationToken ct = default);

        Task<JefeEfectivoResult> ResolverJefeEfectivoAsync(
            int idWorkflow, int idUsuarioCreador, int nivel, CancellationToken ct = default);

        Task<int?> ResolverIdUsuarioJefePorNivelAsync(
            int idUsuarioCreador, int nivel, CancellationToken ct = default);

        Task<bool> AplicaNivelJefeAsync(
            int idUsuarioCreador, int nivel, CancellationToken ct = default);

        Task<IReadOnlyDictionary<int, int>> ResolverIdsJefePorUsuariosAsync(
            IEnumerable<int> idsUsuariosCreador,
            CancellationToken cancellationToken = default);
    }
}
