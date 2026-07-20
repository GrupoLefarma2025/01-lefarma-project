using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Rh.Calendario;
using Lefarma.API.Features.Rh.Calendario.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Rh
{
    public class CalendarioRepository : ICalendarioRepository
    {
        private readonly AsokamDbContext _context;

        public CalendarioRepository(AsokamDbContext context)
        {
            _context = context;
        }

        public async Task<List<CalendarioLaboralResponse>> ObtenerCalendarioLaboralAsync(CalendarioLaboralRequest request)
        {
            var query = _context.GenCalendarioReg.AsNoTracking().AsQueryable();

            if (request.Anio.HasValue)
            {
                if (request.Mes.HasValue)
                {
                    var inicioMes = new DateTime(request.Anio.Value, request.Mes.Value, 1);
                    var finMes = inicioMes.AddMonths(1).AddDays(-1);
                    query = query.Where(c => c.Fecha >= inicioMes && c.Fecha <= finMes);
                }
                else
                {
                    var inicioAnio = new DateTime(request.Anio.Value, 1, 1);
                    var finAnio = inicioAnio.AddYears(1).AddDays(-1);
                    query = query.Where(c => c.Fecha >= inicioAnio && c.Fecha <= finAnio);
                }
            }

            if (request.Mes.HasValue && !request.Anio.HasValue)
                query = query.Where(c => c.Mes == request.Mes.Value);

            if (request.Dia.HasValue)
                query = query.Where(c => c.Dia == request.Dia.Value);

            if (request.Laborable.HasValue)
            {
                var laborable = request.Laborable.Value;
                query = query.Where(c => laborable
                    ? (c.Laborable != null && c.Laborable == 1)
                    : (c.Laborable == null || c.Laborable == 0));
            }

            var result = await query
                .OrderBy(c => c.Fecha)
                .Select(c => new CalendarioLaboralResponse
                {
                    Fecha = c.Fecha,
                    NombreDiaSemana = c.NombreDiaSemana,
                    NombreMes = c.NombreMes,
                    Laborable = c.Laborable != null && c.Laborable == 1
                })
                .ToListAsync();

            if (request.ExcluirSabados)
            {
                result = result.Where(c => c.Fecha.DayOfWeek != DayOfWeek.Saturday).ToList();
            }

            return result;
        }
    }
}
