namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IJefeInmediatoResolver
    {
        Task<int?> ResolverIdUsuarioJefeAsync(int idUsuarioCreador);
    }
}
