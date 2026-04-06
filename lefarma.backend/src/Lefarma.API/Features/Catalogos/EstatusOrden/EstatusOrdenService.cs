using Azure;
using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.EstatusOrden.DTOs;
using Lefarma.API.Features.Catalogos.EstatusOrden.Extensions;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.EstatusOrden
{
public class EstatusOrdenService : BaseService, IEstatusOrdenService
    {
        private readonly IEstatusOrdenRepository _estatusOrdenRepository;
        private readonly ILogger<EstatusOrdenService> _logger;
        protected override string EntityName => "EstatusOrden";

        public EstatusOrdenService(
            IEstatusOrdenRepository estatusOrdenRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<EstatusOrdenService> logger)
            : base(wideEventAccessor)
        {
            _estatusOrdenRepository = estatusOrdenRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<EstatusOrdenResponse>>> GetAllAsync(EstatusOrdenRequest query)
        {
            try
            {
                var queryable = _estatusOrdenRepository.GetQueryable();

                if (query.Activo.HasValue)
                    queryable = queryable.Where(e => e.Activo == query.Activo.Value);

                if (query.RequiereAccion.HasValue)
                    queryable = queryable.Where(e => e.RequiereAccion == query.RequiereAccion.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(e => e.Nombre),
                    ("idestatusorden", "asc") => queryable.OrderBy(e => e.IdEstatusOrden),
                    ("idestatusorden", "desc") => queryable.OrderByDescending(e => e.IdEstatusOrden),
                    _ => queryable.OrderBy(e => e.IdEstatusOrden)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Activo, query.RequiereAccion, query.OrderBy, query.OrderDirection }
                    });
                    return new List<EstatusOrdenResponse>();
                }

                var response = result.Select(e => e.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Activo, query.RequiereAccion, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(e => e.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("obtener los estatus de orden");
            }
        }

        public async Task<ErrorOr<EstatusOrdenResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _estatusOrdenRepository.GetByIdAsync(id);

                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("estatus de orden", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"obtener el estatus de orden");
            }
        }
    }
}
