using ErrorOr;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Rh.Calendario.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;

namespace Lefarma.API.Features.Rh.Calendario
{
    public class CalendarioService : BaseService, ICalendarioService
    {
        private readonly ICalendarioRepository _repository;
        private readonly IEmpleadoRepository _empleadoRepository;

        protected override string EntityName => "Calendario";

        public CalendarioService(
            ICalendarioRepository repository,
            IEmpleadoRepository empleadoRepository,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repository = repository;
            _empleadoRepository = empleadoRepository;
        }

        public async Task<ErrorOr<IEnumerable<CalendarioLaboralResponse>>> ObtenerCalendarioLaboralAsync(CalendarioLaboralRequest request, int idUsuario)
        {
            try
            {
                var dias = await _repository.ObtenerCalendarioLaboralAsync(request);

                EnrichWideEvent("ObtenerCalendarioLaboral", count: dias.Count, additionalContext: new Dictionary<string, object>
                {
                    ["idUsuario"] = idUsuario
                });

                return dias;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerCalendarioLaboral", exception: ex);
                return CommonErrors.DatabaseError("obtener el calendario laboral");
            }
        }

        public async Task<ErrorOr<DiasJornadaResponse>> ObtenerDiasJornadaAsync(int anio, int mes, int idUsuario)
        {
            try
            {
                var empleado = await _empleadoRepository.ObtenerEmpleadoPorUsuarioAsync(idUsuario);
                if (empleado == null)
                {
                    return new DiasJornadaResponse
                    {
                        Lunes = true,
                        Martes = true,
                        Miercoles = true,
                        Jueves = true,
                        Viernes = true,
                        Sabado = true,
                        Domingo = true
                    };
                }

                var response = new DiasJornadaResponse
                {
                    Lunes = empleado.Lunes == 1,
                    Martes = empleado.Martes == 1,
                    Miercoles = empleado.Miercoles == 1,
                    Jueves = empleado.Jueves == 1,
                    Viernes = empleado.Viernes == 1,
                    Sabado = empleado.Sabado == 1,
                    Domingo = empleado.Domingo == 1
                };

                EnrichWideEvent("ObtenerDiasJornada", additionalContext: new Dictionary<string, object>
                {
                    ["idUsuario"] = idUsuario,
                    ["anio"] = anio,
                    ["mes"] = mes
                });

                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerDiasJornada", exception: ex);
                return CommonErrors.DatabaseError("obtener los días de jornada laboral");
            }
        }
    }
}
