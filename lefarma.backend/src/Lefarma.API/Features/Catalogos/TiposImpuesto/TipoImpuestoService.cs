using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.TiposImpuesto.DTOs;
using Lefarma.API.Features.Catalogos.TiposImpuesto.Extensions;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.TiposImpuesto
{
    public class TipoImpuestoService : BaseService, ITipoImpuestoService
    {
        private readonly ITipoImpuestoRepository _tipoImpuestoRepository;
        private readonly ILogger<TipoImpuestoService> _logger;
        protected override string EntityName => "TipoImpuesto";

        public TipoImpuestoService(
            ITipoImpuestoRepository tipoImpuestoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<TipoImpuestoService> logger)
            : base(wideEventAccessor)
        {
            _tipoImpuestoRepository = tipoImpuestoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<TipoImpuestoResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _tipoImpuestoRepository.GetAllAsync();

                var response = (result ?? [])
                    .Where(t => !string.IsNullOrWhiteSpace(t.Nombre))
                    .Select(t => t.ToResponse())
                    .OrderBy(t => t.Nombre)
                    .ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, items: response.Select(t => t.Nombre).ToList());
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.Message);
                return CommonErrors.DatabaseError("obtener los tipos de impuesto");
            }
        }

        public async Task<ErrorOr<TipoImpuestoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _tipoImpuestoRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("TipoImpuesto", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError("obtener el tipo de impuesto");
            }
        }

        public async Task<ErrorOr<TipoImpuestoResponse>> CreateAsync(CreateTipoImpuestoRequest request)
        {
            try
            {
                var existeNombre = await _tipoImpuestoRepository.ExistsAsync(t => t.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("TipoImpuesto", "nombre", request.Nombre);
                }

                var tipoImpuesto = new TipoImpuesto
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Clave = request.Clave,
                    Tasa = request.Tasa,
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _tipoImpuestoRepository.AddAsync(tipoImpuesto);
                EnrichWideEvent(action: "Create", entityId: result.IdTipoImpuesto, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";

                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }

                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: errorMessage);
                return CommonErrors.DatabaseError("guardar el tipo de impuesto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.InternalServerError("Error inesperado al crear el tipo de impuesto.");
            }
        }

        public async Task<ErrorOr<TipoImpuestoResponse>> UpdateAsync(int id, UpdateTipoImpuestoRequest request)
        {
            try
            {
                var tipoImpuesto = await _tipoImpuestoRepository.GetByIdAsync(id);
                if (tipoImpuesto == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("TipoImpuesto", id.ToString());
                }

                var existeNombre = await _tipoImpuestoRepository.ExistsAsync(t => t.Nombre == request.Nombre && t.IdTipoImpuesto != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("TipoImpuesto", "nombre", request.Nombre);
                }

                tipoImpuesto.Nombre = request.Nombre.Trim();
                tipoImpuesto.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                tipoImpuesto.Clave = request.Clave;
                tipoImpuesto.Tasa = request.Tasa;
                tipoImpuesto.Descripcion = request.Descripcion;
                tipoImpuesto.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                tipoImpuesto.FechaModificacion = DateTime.UtcNow;
                tipoImpuesto.Activo = request.Activo;

                var result = await _tipoImpuestoRepository.UpdateAsync(tipoImpuesto);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";

                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }

                EnrichWideEvent(action: "Update", entityId: id, error: errorMessage);
                return CommonErrors.ConcurrencyError("TipoImpuesto");
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";

                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }

                EnrichWideEvent(action: "Update", entityId: id, error: errorMessage);
                return CommonErrors.DatabaseError("actualizar el tipo de impuesto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError("Error inesperado al actualizar el tipo de impuesto.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var tipoImpuesto = await _tipoImpuestoRepository.GetByIdAsync(id);
                if (tipoImpuesto == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("TipoImpuesto", id.ToString());
                }

                var eliminado = await _tipoImpuestoRepository.DeleteAsync(tipoImpuesto);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("TipoImpuesto");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: tipoImpuesto.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.HasDependencies("TipoImpuesto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError("Error inesperado al eliminar el tipo de impuesto.");
            }
        }
    }
}
