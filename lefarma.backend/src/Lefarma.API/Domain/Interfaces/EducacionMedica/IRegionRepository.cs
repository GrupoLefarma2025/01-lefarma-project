using Lefarma.API.Domain.Entities.EducacionMedica;

namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IRegionRepository
{
    Task<List<RegionCatalogo>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<RegionCatalogo?> GetByIdAsync(int idRegion, CancellationToken cancellationToken = default);

    Task<RegionCatalogo?> GetByNombreAsync(string nombre, CancellationToken cancellationToken = default);

    Task<RegionCatalogo> CreateAsync(RegionCatalogo region, CancellationToken cancellationToken = default);

    Task UpdateAsync(RegionCatalogo region, CancellationToken cancellationToken = default);

    Task<Dictionary<int, int>> GetConteosHospitalesAsync(CancellationToken cancellationToken = default);

    Task<List<RegionEstado>> GetMapeosAsync(CancellationToken cancellationToken = default);

    Task<RegionEstado?> GetMapeoByEstadoAsync(int codigoEstado, CancellationToken cancellationToken = default);

    Task<RegionEstado> CreateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default);

    Task UpdateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reemplaza el conjunto de estados de una región: quita los que salieron,
    /// mueve a esta región los que estaban en otra (1 estado = 1 región) y agrega
    /// los nuevos. No toca hospitales.
    /// </summary>
    Task SyncEstadosAsync(
        int idRegion,
        IEnumerable<int> codigoEstados,
        int idUsuario,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cuenta hospitales cuya región difiere del mapeo de su estado (cross-DB).
    /// </summary>
    Task<List<MapeoPendienteAplicar>> PreviewAplicarMapeoAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Asigna a cada hospital la región de su estado donde difiere (cross-DB).
    /// Devuelve la cantidad de hospitales movidos.
    /// </summary>
    Task<int> AplicarMapeoAsync(int idUsuario, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cuenta, por región, los hospitales SIN región y SIN mapeo de estado que se
    /// asignarían a la región activa con centroide más cercano (cross-DB, GPS).
    /// Debe consultarse/aplicarse después del pase por estado.
    /// </summary>
    Task<List<MapeoGpsPendienteAplicar>> PreviewAplicarMapeoGpsAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Asigna por GPS (centroide más cercano) los hospitales que quedan sin región
    /// tras el pase por estado. Nunca toca hospitales que ya tienen id_region.
    /// Devuelve la cantidad asignada.
    /// </summary>
    Task<int> AplicarMapeoGpsAsync(int idUsuario, CancellationToken cancellationToken = default);

    /// <summary>
    /// Hospitales que tras ambos pases seguirían sin región por falta de coordenadas
    /// válidas (cross-DB).
    /// </summary>
    Task<int> ContarSinRegionSinCoordenadasAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Fila de conteo para el preview del pase GPS (SQL cross-DB).
/// </summary>
public class MapeoGpsPendienteAplicar
{
    public int IdRegion { get; set; }
    public int Hospitales { get; set; }
}

/// <summary>
/// Fila de conteo para el preview de aplicación del mapeo (SQL cross-DB).
/// </summary>
public class MapeoPendienteAplicar
{
    public int CodigoEstado { get; set; }
    public int IdRegion { get; set; }
    public int Hospitales { get; set; }
}
