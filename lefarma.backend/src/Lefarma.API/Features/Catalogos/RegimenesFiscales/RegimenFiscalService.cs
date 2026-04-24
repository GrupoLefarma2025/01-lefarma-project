using Azure;
using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.RegimenesFiscales.DTOs;
using Lefarma.API.Features.Catalogos.RegimenesFiscales.Extensions;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.RegimenesFiscales
{
public class RegimenFiscalService : BaseService, IRegimenFiscalService
    {
        private readonly IRegimenFiscalRepository _regimenFiscalRepository;
        private readonly ILogger<RegimenFiscalService> _logger;
        protected override string EntityName => "RegimenFiscal";

        public RegimenFiscalService(
            IRegimenFiscalRepository regimenFiscalRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<RegimenFiscalService> logger)
            : base(wideEventAccessor)
        {
            _regimenFiscalRepository = regimenFiscalRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<RegimenFiscalResponse>>> GetAllAsync(RegimenFiscalRequest query)
        {
            try
            {
                var queryable = _regimenFiscalRepository.GetQueryable();

                if (!string.IsNullOrWhiteSpace(query.Clave))
                    queryable = queryable.Where(r => r.Clave.Contains(query.Clave));

                if (!string.IsNullOrWhiteSpace(query.TipoPersona))
                    queryable = queryable.Where(r => r.TipoPersona == query.TipoPersona);

                if (query.Activo.HasValue)
                    queryable = queryable.Where(r => r.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("clave", "desc") => queryable.OrderByDescending(r => r.Clave),
                    ("descripcion", "asc") => queryable.OrderBy(r => r.Descripcion),
                    ("descripcion", "desc") => queryable.OrderByDescending(r => r.Descripcion),
                    _ => queryable.OrderBy(r => r.Clave)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Clave, query.TipoPersona, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<RegimenFiscalResponse>();
                }

                var response = result.Select(r => r.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Clave, query.TipoPersona, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(r => r.Clave + " - " + r.Descripcion).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("obtener los regímenes fiscales");
            }
        }

        public async Task<ErrorOr<RegimenFiscalResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _regimenFiscalRepository.GetByIdAsync(id);

                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("RegimenFiscal", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Clave + " - " + response.Descripcion);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"obtener el régimen fiscal");
            }
        }

        public async Task<ErrorOr<RegimenFiscalResponse>> CreateAsync(CreateRegimenFiscalRequest request)
        {
            try
            {
                var existeClave = await _regimenFiscalRepository.ExistsAsync(r => r.Clave == request.Clave);
                if (existeClave)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Clave, duplicate: true);
                    return CommonErrors.AlreadyExists("RegimenFiscal", "clave", request.Clave);
                }

                var newRegimenFiscal = new RegimenFiscal
                {
                    Clave = request.Clave,
                    Descripcion = request.Descripcion,
                    TipoPersona = request.TipoPersona,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _regimenFiscalRepository.AddAsync(newRegimenFiscal);
                EnrichWideEvent(action: "Create", entityId: result.IdRegimenFiscal, nombre: result.Clave + " - " + result.Descripcion);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Clave, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"guardar el régimen fiscal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Clave, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al crear el régimen fiscal.");
            }
        }

        public async Task<ErrorOr<RegimenFiscalResponse>> UpdateAsync(int id, UpdateRegimenFiscalRequest request)
        {
            try
            {
                var regimenFiscal = await _regimenFiscalRepository.GetByIdAsync(id);
                if (regimenFiscal == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("RegimenFiscal", id.ToString());
                }

                var existeClave = await _regimenFiscalRepository.ExistsAsync(r => r.Clave == request.Clave && r.IdRegimenFiscal != id);
                if (existeClave)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Clave, duplicate: true);
                    return CommonErrors.AlreadyExists("RegimenFiscal", "clave", request.Clave);
                }

                regimenFiscal.Clave = request.Clave;
                regimenFiscal.Descripcion = request.Descripcion;
                regimenFiscal.TipoPersona = request.TipoPersona;
                regimenFiscal.Activo = request.Activo;

                var result = await _regimenFiscalRepository.UpdateAsync(regimenFiscal);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Clave + " - " + result.Descripcion);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.ConcurrencyError("RegimenFiscal");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"actualizar el régimen fiscal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el régimen fiscal.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var regimenFiscal = await _regimenFiscalRepository.GetByIdAsync(id);
                if (regimenFiscal == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("RegimenFiscal", id.ToString());
                }

                var eliminado = await _regimenFiscalRepository.DeleteAsync(regimenFiscal);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("RegimenFiscal");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: regimenFiscal.Clave + " - " + regimenFiscal.Descripcion);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.HasDependencies("RegimenFiscal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el régimen fiscal.");
            }
        }
    }
}
