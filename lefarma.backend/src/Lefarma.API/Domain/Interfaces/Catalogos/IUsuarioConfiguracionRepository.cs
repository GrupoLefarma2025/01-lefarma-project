namespace Lefarma.API.Domain.Interfaces.Catalogos;

public interface IUsuarioConfiguracionRepository
{
    Task<List<int>> GetDestinatariosDefaultAsync(int idUsuario, CancellationToken ct = default);
    Task GuardarDestinatariosDefaultAsync(int idUsuario, List<int> destinatarios, CancellationToken ct = default);
}
