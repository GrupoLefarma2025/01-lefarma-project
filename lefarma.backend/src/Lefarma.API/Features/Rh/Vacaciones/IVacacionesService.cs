using ErrorOr;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;

namespace Lefarma.API.Features.Rh.Vacaciones
{
    public interface IVacacionesService
    {
        Task<ErrorOr<List<DiaNoHabilResponse>>> ObtenerDiasNoHabilesAsync(DiaNoHabilRequest request);
        Task<ErrorOr<CargaDiasNoHabilesResultResponse>> CargarDiasNoHabilesManualAsync(CargaDiasNoHabilesRequest request, int idUsuario);
        Task<ErrorOr<CargaDiasNoHabilesResultResponse>> CargarDiasNoHabilesDesdeCsvAsync(IFormFile file, int idEmpresa, int? idSucursal, int idUsuario);
        Task<ErrorOr<Deleted>> EliminarDiaNoHabilAsync(int idDiaNoHabil, int idUsuario);
        Task<ErrorOr<List<DiaUsuarioResponse>>> ObtenerUsuariosAfectadosAsync(int idDiaNoHabil);
        Task<ErrorOr<List<DiaUsuarioResponse>>> ObtenerDiasUsuarioAsync(DiaUsuarioRequest request);
        Task<ErrorOr<List<SaldoVacacionesResponse>>> ObtenerSaldosAsync(SaldoVacacionesRequest request);
        Task<ErrorOr<SaldoVacacionesResponse>> CargarSaldoAsync(SaldoVacacionesCreateRequest request, int idUsuario);
        Task<ErrorOr<SincronizarSaldosResponse>> SincronizarSaldosAsync(SincronizarSaldosRequest request, int idUsuario);
    }
}
