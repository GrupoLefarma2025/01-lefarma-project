using Lefarma.API.Features.Rh.Calendario.DTOs;

namespace Lefarma.API.Domain.Interfaces.Rh
{
    public interface ICalendarioRepository
    {
        Task<List<CalendarioLaboralResponse>> ObtenerCalendarioLaboralAsync(CalendarioLaboralRequest request);
    }
}
