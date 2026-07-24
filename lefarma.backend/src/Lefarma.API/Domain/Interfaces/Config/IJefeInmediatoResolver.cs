namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IJefeInmediatoResolver
    {
        Task<int?> ResolverIdUsuarioJefeAsync(int idUsuarioCreador);

        Task<IReadOnlyDictionary<int, int>> ResolverIdsJefePorUsuariosAsync(
            IEnumerable<int> idsUsuariosCreador,
            CancellationToken cancellationToken = default);
    }
}
