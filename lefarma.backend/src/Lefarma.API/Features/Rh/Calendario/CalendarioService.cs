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

        protected override string EntityName => "Calendario";

        public CalendarioService(
            ICalendarioRepository repository,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repository = repository;
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
    }
}
