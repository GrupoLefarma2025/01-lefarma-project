using Azure;
using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Areas.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.Areas
{
public class AreaService : BaseService, IAreaService
    {
        private readonly IAreaRepository _areaRepository;
        private readonly IEmpresaRepository _empresaRepository;
        private readonly ILogger<AreaService> _logger;
        protected override string EntityName => "Area";

        public AreaService(IAreaRepository areaRepository,
            IEmpresaRepository empresaRepository,
            IWideEventAccessor wideEventAccessor, 
            ILogger<AreaService> logger)
            : base(wideEventAccessor)
        {
            _areaRepository = areaRepository;
            _empresaRepository = empresaRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<AreaResponse>>> GetAllAsync(AreaRequest query)
        {
            try
            {
                var queryable = _areaRepository.GetQueryable();

                if (query.IdEmpresa.HasValue)
                    queryable = queryable.Where(a => a.IdEmpresa == query.IdEmpresa.Value);

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(a => a.Nombre.Contains(query.Nombre));

                if (query.Activo.HasValue)
                    queryable = queryable.Where(a => a.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(a => a.Nombre),
                    ("fechacreacion", "asc") => queryable.OrderBy(a => a.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(a => a.FechaCreacion),
                    _ => queryable.OrderBy(a => a.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.IdEmpresa, query.Nombre, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<AreaResponse>();
                }

                var response = result.Select(a => a.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.IdEmpresa, query.Nombre, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(a => a.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener las areas");
            }
        }

        public async Task<ErrorOr<AreaResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _areaRepository.GetByIdAsync(id);

                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("area", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"obtener el area");
            }
        }

        public async Task<ErrorOr<AreaResponse>> CreateAsync(CreateAreaRequest request)
        {
            try
            {
                var empresaExiste = await _empresaRepository.ExistsAsync(e => e.IdEmpresa == request.IdEmpresa);
                if (!empresaExiste)
                {
                    EnrichWideEvent(action: "Create", entityId: request.IdEmpresa, notFound: true);
                    return CommonErrors.NotFound("empresa", request.IdEmpresa.ToString());
                }

                var existeNombre = await _areaRepository.ExistsAsync(s => s.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("area", "nombre", request.Nombre);
                }

                var newArea = new Area
                {
                    IdEmpresa = request.IdEmpresa,
                    Nombre = request.Nombre,
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Clave = request.Clave,
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _areaRepository.AddAsync(newArea);
                EnrichWideEvent(action: "Create", entityId: result.IdArea, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError($"guardar el area");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al crear el area.");
            }
        }

        public async Task<ErrorOr<AreaResponse>> UpdateAsync(int id, UpdateAreaRequest request)
        {
            try
            {
                var empresaExiste = await _empresaRepository.ExistsAsync(e => e.IdEmpresa == request.IdEmpresa);
                if (!empresaExiste)
                {
                    EnrichWideEvent(action: "Update", entityId: request.IdEmpresa, notFound: true);
                    return CommonErrors.NotFound("empresa", request.IdEmpresa.ToString());
                }

                var area = await _areaRepository.GetByIdAsync(id);
                if (area == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("area", id.ToString());
                }

                var existeNombre = await _areaRepository.ExistsAsync(s => s.Nombre == request.Nombre && s.IdArea != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("area", "nombre", request.Nombre);
                }

                area.Nombre = request.Nombre;
                area.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                area.Clave = request.Clave;
                area.Descripcion = request.Descripcion;
                area.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                area.Activo = request.Activo;
                area.FechaModificacion = DateTime.UtcNow;

                var result = await _areaRepository.UpdateAsync(area);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.ConcurrencyError("area");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"actualizar el area");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el area.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var area = await _areaRepository.GetByIdAsync(id);
                if (area == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("area", id.ToString());
                }

                var eliminado = await _areaRepository.DeleteAsync(area);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("area");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: area.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.HasDependencies("Area");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el area.");
            }
        }
    }
}
