using ErrorOr;
using Lefarma.API.Features.Rh.Calendario.DTOs;

namespace Lefarma.API.Features.Rh.Calendario
{
    public interface ICalendarioService
    {
        Task<ErrorOr<IEnumerable<CalendarioLaboralResponse>>> ObtenerCalendarioLaboralAsync(CalendarioLaboralRequest request, int idUsuario);
    }
}
