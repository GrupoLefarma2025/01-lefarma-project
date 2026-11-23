namespace Lefarma.API.Features.OrdenesCompra.Visibilidad;

public sealed record AlcanceOrdenCompra(
    int IdUsuario,
    bool VerTodas,
    IReadOnlySet<int> Empresas,
    IReadOnlySet<int> Workflows,
    IReadOnlySet<int> PasosParticipante,
    IReadOnlyDictionary<int, int> NivelPorPaso,
    IReadOnlySet<int> CreadoresPosibles)
{
    public static AlcanceOrdenCompra Vacio(int idUsuario) => new(
        idUsuario,
        VerTodas: false,
        Empresas: new HashSet<int>(),
        Workflows: new HashSet<int>(),
        PasosParticipante: new HashSet<int>(),
        NivelPorPaso: new Dictionary<int, int>(),
        CreadoresPosibles: new HashSet<int>());
}
