using Azure;
using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.CentrosCosto.DTOs;
using Lefarma.API.Features.Catalogos.CentrosCosto.Extensions;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.CentrosCosto
{
public class CentroCostoService : BaseService, ICentroCostoService
    {
        private readonly ICentroCostoRepository _centroCostoRepository;
        private readonly ILogger<CentroCostoService> _logger;
        protected override string EntityName => "CentroCosto";

        public CentroCostoService(
            ICentroCostoRepository centroCostoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<CentroCostoService> logger)
            : base(wideEventAccessor)
        {
            _centroCostoRepository = centroCostoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<CentroCostoResponse>>> GetAllAsync(CentroCostoRequest query)
        {
            try
            {
                var queryable = _centroCostoRepository.GetQueryable();

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(c => c.Nombre.Contains(query.Nombre));

                if (query.Activo.HasValue)
                    queryable = queryable.Where(c => c.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(c => c.Nombre),
                    ("fechacreacion", "asc") => queryable.OrderBy(c => c.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(c => c.FechaCreacion),
                    _ => queryable.OrderBy(c => c.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Nombre, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<CentroCostoResponse>();
                }

                var response = result.Select(c => c.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Nombre, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(c => c.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("obtener los centros de costo");
            }
        }

        public async Task<ErrorOr<CentroCostoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _centroCostoRepository.GetByIdAsync(id);

                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("CentroCosto", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"obtener el centro de costo");
            }
        }

        public async Task<ErrorOr<CentroCostoResponse>> CreateAsync(CreateCentroCostoRequest request)
        {
            try
            {
                var existeNombre = await _centroCostoRepository.ExistsAsync(c => c.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("CentroCosto", "nombre", request.Nombre);
                }

                var newCentroCosto = new CentroCosto
                {
                    Nombre = request.Nombre,
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    LimitePresupuesto = request.LimitePresupuesto,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _centroCostoRepository.AddAsync(newCentroCosto);
                EnrichWideEvent(action: "Create", entityId: result.IdCentroCosto, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"guardar el centro de costo");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al crear el centro de costo.");
            }
        }

        public async Task<ErrorOr<CentroCostoResponse>> UpdateAsync(int id, UpdateCentroCostoRequest request)
        {
            try
            {
                var centroCosto = await _centroCostoRepository.GetByIdAsync(id);
                if (centroCosto == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("CentroCosto", id.ToString());
                }

                var existeNombre = await _centroCostoRepository.ExistsAsync(c => c.Nombre == request.Nombre && c.IdCentroCosto != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("CentroCosto", "nombre", request.Nombre);
                }

                centroCosto.Nombre = request.Nombre;
                centroCosto.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                centroCosto.Descripcion = request.Descripcion;
                centroCosto.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                centroCosto.LimitePresupuesto = request.LimitePresupuesto;
                centroCosto.Activo = request.Activo;
                centroCosto.FechaModificacion = DateTime.UtcNow;

                var result = await _centroCostoRepository.UpdateAsync(centroCosto);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.ConcurrencyError("CentroCosto");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"actualizar el centro de costo");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el centro de costo.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var centroCosto = await _centroCostoRepository.GetByIdAsync(id);
                if (centroCosto == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("CentroCosto", id.ToString());
                }

                var eliminado = await _centroCostoRepository.DeleteAsync(centroCosto);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("CentroCosto");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: centroCosto.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.HasDependencies("CentroCosto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el centro de costo.");
            }
        }
    }
}
