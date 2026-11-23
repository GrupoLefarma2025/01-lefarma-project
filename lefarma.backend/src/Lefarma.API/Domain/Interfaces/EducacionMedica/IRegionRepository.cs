using Lefarma.API.Domain.Entities.EducacionMedica;

namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IRegionRepository
{
    Task<List<RegionCatalogo>> GetAllAsync(CancellationToken cancellationToken = default, int? idTipoGerencia = null);

    Task<RegionCatalogo?> GetByIdAsync(int idRegion, CancellationToken cancellationToken = default);

    Task<RegionCatalogo?> GetByNombreAsync(string nombre, CancellationToken cancellationToken = default, int? idTipoGerencia = null);

    Task<RegionCatalogo> CreateAsync(RegionCatalogo region, CancellationToken cancellationToken = default);

    Task UpdateAsync(RegionCatalogo region, CancellationToken cancellationToken = default);

    Task<Dictionary<int, int>> GetConteosHospitalesAsync(CancellationToken cancellationToken = default);

    Task<List<RegionEstado>> GetMapeosAsync(CancellationToken cancellationToken = default, int? idTipoGerencia = null);

    Task<RegionEstado?> GetMapeoByEstadoAsync(int codigoEstado, CancellationToken cancellationToken = default, int? idTipoGerencia = null);

    Task<RegionEstado> CreateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default);

    Task UpdateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default);

    Task SyncEstadosAsync(
        int idRegion,
        IEnumerable<int> codigoEstados,
        int idUsuario,
        CancellationToken cancellationToken = default);

    Task<List<MapeoPendienteAplicar>> PreviewAplicarMapeoAsync(
        CancellationToken cancellationToken = default,
        int? idTipoGerencia = null);

    Task<int> AplicarMapeoAsync(int idUsuario, CancellationToken cancellationToken = default, int? idTipoGerencia = null);

    Task<List<MapeoGpsPendienteAplicar>> PreviewAplicarMapeoGpsAsync(
        CancellationToken cancellationToken = default,
        int? idTipoGerencia = null);

    Task<int> AplicarMapeoGpsAsync(int idUsuario, CancellationToken cancellationToken = default, int? idTipoGerencia = null);

    Task<int> ContarSinRegionSinCoordenadasAsync(CancellationToken cancellationToken = default, int? idTipoGerencia = null);
}

public class MapeoGpsPendienteAplicar
{
    public int IdRegion { get; set; }
    public int Hospitales { get; set; }
}

public class MapeoPendienteAplicar
{
    public int CodigoEstado { get; set; }
    public int IdRegion { get; set; }
    public int Hospitales { get; set; }
}
