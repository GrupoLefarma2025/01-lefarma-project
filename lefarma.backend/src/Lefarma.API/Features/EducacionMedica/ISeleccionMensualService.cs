using ErrorOr;

namespace Lefarma.API.Features.EducacionMedica;

public interface ISeleccionMensualService
{
    Task<List<DTOs.SeleccionMensualDto>> GetAllAsync(
        int? anio,
        int? mes,
        int idUsuario,
        CancellationToken ct = default);

    Task<DTOs.SeleccionDetalleDto?> GetByIdAsync(int idSeleccionMensual, CancellationToken ct = default);

    Task<DTOs.SeleccionMensualDto> CreateAsync(
        DTOs.CrearSeleccionMensualRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<DTOs.SeleccionHospitalDto> AgregarHospitalAsync(
        int idSeleccionMensual,
        DTOs.AgregarHospitalSeleccionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task QuitarHospitalAsync(
        int idSeleccionMensual,
        int idSeleccionHospital,
        int idUsuario,
        CancellationToken ct = default);

    Task SincronizarRegionesAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default);

    Task<DTOs.AgruparSeleccionResponse> AgruparAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default);

    Task<DTOs.SeleccionRegionDto> AsignarEquipoAsync(
        int idSeleccionMensual,
        int idRegion,
        DTOs.AsignarEquipoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<DTOs.SeleccionRegionDto>> DividirRegionAsync(
        int idSeleccionMensual,
        int idRegion,
        DTOs.DividirRegionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task AsignarRegionAHospitalAsync(
        int idSeleccionMensual,
        int idSeleccionHospital,
        DTOs.MoverHospitalARegionRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<List<DTOs.HospitalCercanoOtraSeleccionDto>> ObtenerHospitalesCercanosAsync(
        int idSeleccionMensual,
        CancellationToken ct = default);

    Task<DTOs.SeleccionMensualDto> EnviarRevisionAsync(int idSeleccionMensual, int idUsuario, CancellationToken ct = default);

    Task<DTOs.SeleccionMensualDto> FirmarAsync(
        int idSeleccionMensual,
        DTOs.FirmarWorkflowRequest request,
        int idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<IEnumerable<Lefarma.API.Features.Config.Workflows.DTOs.AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idSeleccionMensual,
        int idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<IEnumerable<Lefarma.API.Features.Config.Workflows.DTOs.HistorialWorkflowItemResponse>>> GetHistorialAsync(
        int idSeleccionMensual,
        CancellationToken ct = default);
}
