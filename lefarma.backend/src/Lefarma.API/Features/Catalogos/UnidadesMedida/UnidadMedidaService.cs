using Azure;
using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.UnidadesMedida
{
public class UnidadMedidaService : BaseService, IUnidadMedidaService
    {
        private readonly IUnidadMedidaRepository _unidadMedidaRepository;
        private readonly IMedidaRepository _medidaRepository;
        private readonly ILogger<UnidadMedidaService> _logger;
        protected override string EntityName => "UnidadMedida";

        public UnidadMedidaService(
            IUnidadMedidaRepository unidadMedidaRepository,
            IMedidaRepository medidaRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<UnidadMedidaService> logger)
            : base(wideEventAccessor)
        {
            _unidadMedidaRepository = unidadMedidaRepository;
            _medidaRepository = medidaRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<UnidadMedidaResponse>>> GetAllAsync(UnidadMedidaRequest query)
        {
            try
            {
                IQueryable<UnidadMedida> queryable = _unidadMedidaRepository.GetQueryable()
                    .Include(um => um.Medida);

                if (query.IdMedida.HasValue)
                    queryable = queryable.Where(um => um.IdMedida == query.IdMedida.Value);

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(um => um.Nombre.Contains(query.Nombre));

                if (!string.IsNullOrWhiteSpace(query.Abreviatura))
                    queryable = queryable.Where(um => um.Abreviatura.Contains(query.Abreviatura));

                if (query.Activo.HasValue)
                    queryable = queryable.Where(um => um.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(um => um.Nombre),
                    ("abreviatura", "asc") => queryable.OrderBy(um => um.Abreviatura),
                    ("abreviatura", "desc") => queryable.OrderByDescending(um => um.Abreviatura),
                    ("fechacreacion", "asc") => queryable.OrderBy(um => um.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(um => um.FechaCreacion),
                    _ => queryable.OrderBy(um => um.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.IdMedida, query.Nombre, query.Abreviatura, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<UnidadMedidaResponse>();
                }

                var response = result.Select(um => um.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.IdMedida, query.Nombre, query.Abreviatura, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(um => um.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener las unidades de medida");
            }
        }

        public async Task<ErrorOr<UnidadMedidaResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _unidadMedidaRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("unidad de medida", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"obtener la unidad de medida");
            }
        }

        public async Task<ErrorOr<UnidadMedidaResponse>> CreateAsync(CreateUnidadMedidaRequest request)
        {
            try
            {
                var medidaExiste = await _medidaRepository.ExistsAsync(t => t.IdMedida == request.IdMedida);
                if (!medidaExiste)
                {
                    EnrichWideEvent(action: "Create", entityId: request.IdMedida, notFound: true);
                    return CommonErrors.NotFound("medida", request.IdMedida.ToString());
                }

                var existeNombre = await _unidadMedidaRepository.ExistsAsync(u => u.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("unidad de medida", "nombre", request.Nombre);
                }

                var existeAbreviatura = await _unidadMedidaRepository.ExistsAsync(u => u.Abreviatura == request.Abreviatura);
                if (existeAbreviatura)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Abreviatura, duplicate: true);
                    return CommonErrors.AlreadyExists("unidad de medida", "abreviatura", request.Abreviatura);
                }

                var unidadMedida = new UnidadMedida
                {
                    IdMedida = request.IdMedida,
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Abreviatura = request.Abreviatura.Trim().ToUpperInvariant(),
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _unidadMedidaRepository.AddAsync(unidadMedida);
                EnrichWideEvent(action: "Create", entityId: result.IdUnidadMedida, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError($"guardar la unidad de medida");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al crear la unidad de medida.");
            }
        }

        public async Task<ErrorOr<UnidadMedidaResponse>> UpdateAsync(int id, UpdateUnidadMedidaRequest request)
        {
            try
            {
                var medidaExiste = await _medidaRepository.ExistsAsync(t => t.IdMedida == request.IdMedida);
                if (!medidaExiste)
                {
                    EnrichWideEvent(action: "Update", entityId: request.IdMedida, notFound: true);
                    return CommonErrors.NotFound("medida", request.IdMedida.ToString());
                }

                var unidadMedida = await _unidadMedidaRepository.GetByIdAsync(id);
                if (unidadMedida == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("unidad de medida", id.ToString());
                }

                var existeNombre = await _unidadMedidaRepository.ExistsAsync(u => u.Nombre == request.Nombre && u.IdUnidadMedida != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("unidad de medida", "nombre", request.Nombre);
                }

                var existeAbreviatura = await _unidadMedidaRepository.ExistsAsync(u => u.Abreviatura == request.Abreviatura && u.IdUnidadMedida != id);
                if (existeAbreviatura)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Abreviatura, duplicate: true);
                    return CommonErrors.AlreadyExists("unidad de medida", "abreviatura", request.Abreviatura);
                }

                unidadMedida.IdMedida = request.IdMedida;
                unidadMedida.Nombre = request.Nombre.Trim();
                unidadMedida.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                unidadMedida.Descripcion = request.Descripcion;
                unidadMedida.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                unidadMedida.Abreviatura = request.Abreviatura.Trim().ToUpperInvariant();
                unidadMedida.Activo = request.Activo;
                unidadMedida.FechaModificacion = DateTime.UtcNow;

                var result = await _unidadMedidaRepository.UpdateAsync(unidadMedida);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.ConcurrencyError("unidad de medida");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"actualizar la unidad de medida");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la unidad de medida.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var unidadMedida = await _unidadMedidaRepository.GetByIdAsync(id);
                if (unidadMedida == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound(" unidad de medida", id.ToString());
                }

                var eliminado = await _unidadMedidaRepository.DeleteAsync(unidadMedida);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("unidad de medida");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: unidadMedida.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"eliminar la unidad de medida");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la unidad de medida.");
            }
        }

    }
}
