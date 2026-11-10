namespace Lefarma.API.Features.OrdenesCompra.Visibilidad;

/// <summary>
/// Alcance de visibilidad resuelto para un usuario sobre las órdenes de compra.
/// Los alcances son acumulables (OR): total, por empresa, por flujo y el alcance
/// base (órdenes propias, detenidas en un paso donde participa o de su jefe inmediato).
/// </summary>
public sealed record AlcanceOrdenCompra(
    int IdUsuario,
    bool VerTodas,
    IReadOnlySet<int> Empresas,
    IReadOnlySet<int> Workflows,
    IReadOnlySet<int> PasosParticipante,
    IReadOnlyDictionary<int, int> NivelPorPaso,
    IReadOnlySet<int> CreadoresPosibles)
{
    /// <summary>Alcance sin ninguna ampliación: solo aplica el comportamiento base.</summary>
    public static AlcanceOrdenCompra Vacio(int idUsuario) => new(
        idUsuario,
        VerTodas: false,
        Empresas: new HashSet<int>(),
        Workflows: new HashSet<int>(),
        PasosParticipante: new HashSet<int>(),
        NivelPorPaso: new Dictionary<int, int>(),
        CreadoresPosibles: new HashSet<int>());
}
