using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.TiposGasto.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.TiposGasto
{
    public class TipoGastoService : BaseService, ITipoGastoService
    {
        private readonly ITipoGastoRepository _tipoGastoRepository;
        private readonly ILogger<TipoGastoService> _logger;
        protected override string EntityName => "TiposGasto";

        public TipoGastoService(ITipoGastoRepository tipoGastoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<TipoGastoService> logger)
            : base(wideEventAccessor)
        {
            _tipoGastoRepository = tipoGastoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<TipoGastoResponse>>> GetAllAsync(TipoGastoRequest query)
        {
            try
            {
                IQueryable<TipoGasto> queryable = _tipoGastoRepository.GetQueryable();

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(g => g.Nombre.Contains(query.Nombre));

                if (query.RequiereComprobacionPago.HasValue)
                    queryable = queryable.Where(g => g.RequiereComprobacionPago == query.RequiereComprobacionPago.Value);

                if (query.RequiereComprobacionGasto.HasValue)
                    queryable = queryable.Where(g => g.RequiereComprobacionGasto == query.RequiereComprobacionGasto.Value);

                if (query.Activo.HasValue)
                    queryable = queryable.Where(g => g.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(g => g.Nombre),
                    ("fechacreacion", "asc") => queryable.OrderBy(g => g.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(g => g.FechaCreacion),
                    _ => queryable.OrderBy(g => g.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Nombre, query.RequiereComprobacionPago, query.RequiereComprobacionGasto, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<TipoGastoResponse>();
                }

                var response = result.Select(g => g.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Nombre, query.RequiereComprobacionPago, query.RequiereComprobacionGasto, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(g => g.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener los tipos de gasto");
            }
        }

        public async Task<ErrorOr<TipoGastoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _tipoGastoRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("tipo de gasto", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"obtener el tipo de gasto");
            }
        }

        public async Task<ErrorOr<TipoGastoResponse>> CreateAsync(CreateTipoGastoRequest request)
        {
            try
            {
                var existeNombre = await _tipoGastoRepository.ExistsAsync(s => s.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("tipo de gasto", "nombre", request.Nombre!);
                }

                var tipoGasto = new TipoGasto
                {
                    Nombre = request.Nombre,
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    Clave = request.Clave,
                    RequiereComprobacionPago = request.RequiereComprobacionPago,
                    RequiereComprobacionGasto = request.RequiereComprobacionGasto,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _tipoGastoRepository.AddAsync(tipoGasto);

                EnrichWideEvent(action: "Create", entityId: result.IdTipoGasto, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError($"guardar el tipo de gasto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al crear el tipo de gasto.");
            }
        }

        public async Task<ErrorOr<TipoGastoResponse>> UpdateAsync(int id, UpdateTipoGastoRequest request)
        {
            try
            {
                var tipoGasto = await _tipoGastoRepository.GetByIdAsync(id);
                if (tipoGasto == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("tipo de gasto", id.ToString());
                }

                var existeNombre = await _tipoGastoRepository.ExistsAsync(s => s.Nombre == request.Nombre && s.IdTipoGasto != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("tipo de gasto", "nombre", request.Nombre!);
                }

                tipoGasto.Nombre = request.Nombre;
                tipoGasto.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                tipoGasto.Descripcion = request.Descripcion;
                tipoGasto.Clave = request.Clave;
                tipoGasto.RequiereComprobacionPago = request.RequiereComprobacionPago;
                tipoGasto.RequiereComprobacionGasto = request.RequiereComprobacionGasto;
                tipoGasto.Activo = request.Activo;
                tipoGasto.FechaModificacion = DateTime.UtcNow;

                var result = await _tipoGastoRepository.UpdateAsync(tipoGasto);

                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.ConcurrencyError("tipo de gasto");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"actualizar el tipo de gasto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el tipo de gasto.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var tipoGasto = await _tipoGastoRepository.GetByIdAsync(id);
                if (tipoGasto == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("tipo de gasto", id.ToString());
                }

                var eliminado = await _tipoGastoRepository.DeleteAsync(tipoGasto);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("tipo de gasto");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: tipoGasto.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.HasDependencies("Tipo de Gasto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el tipo de gasto.");
            }
        }
    }
}
