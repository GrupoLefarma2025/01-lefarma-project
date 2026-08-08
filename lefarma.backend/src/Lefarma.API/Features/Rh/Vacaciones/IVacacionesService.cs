using ErrorOr;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;

namespace Lefarma.API.Features.Rh.Vacaciones
{
    public interface IVacacionesService
    {
        Task<ErrorOr<List<DiaHabilResponse>>> ObtenerDiasHabilesAsync(DiaHabilRequest request);
        Task<ErrorOr<CargaDiasHabilesResultResponse>> CargarDiasHabilesManualAsync(CargaDiasHabilesRequest request, int idUsuario);
        Task<ErrorOr<CargaDiasHabilesResultResponse>> CargarDiasHabilesDesdeCsvAsync(IFormFile file, int idEmpresa, int? idSucursal, int idUsuario);
        Task<ErrorOr<Deleted>> EliminarDiaHabilAsync(int idDiaHabil, int idUsuario);
        Task<ErrorOr<List<SaldoVacacionesResponse>>> ObtenerSaldosAsync(SaldoVacacionesRequest request);
        Task<ErrorOr<SaldoVacacionesResponse>> CargarSaldoAsync(SaldoVacacionesCreateRequest request, int idUsuario);
        Task<ErrorOr<SincronizarSaldosResponse>> SincronizarSaldosAsync(SincronizarSaldosRequest request, int idUsuario);

        Task<ErrorOr<List<UsuarioAfectadoResponse>>> ObtenerUsuariosAfectadosAsync(int idDiaHabil);
    }
}
