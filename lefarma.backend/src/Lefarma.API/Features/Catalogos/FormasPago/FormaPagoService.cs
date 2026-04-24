using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;
using Lefarma.API.Features.Catalogos.FormasPago.Extensions;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.FormasPago
{
public class FormaPagoService : BaseService, IFormaPagoService
    {
        private readonly IFormaPagoRepository _formaPagoRepository;
        private readonly ILogger<FormaPagoService> _logger;
        protected override string EntityName => "FormaPago";

        public FormaPagoService(
            IFormaPagoRepository formaPagoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<FormaPagoService> logger)
            : base(wideEventAccessor)
        {
            _formaPagoRepository = formaPagoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<FormaPagoResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _formaPagoRepository.GetAllAsync();

                var response = (result ?? [])
                    .Where(e => e != null && e.Nombre != null && !string.IsNullOrWhiteSpace(e.Nombre))
                    .Select(e => e!.ToResponse())
                    .OrderBy(e => e.Nombre)
                    .ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, items: response.Select(e => e.Nombre).ToList());
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.Message);
                return CommonErrors.DatabaseError("obtener las formas de pago");
            }
        }

        public async Task<ErrorOr<FormaPagoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _formaPagoRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("FormaPago", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"obtener la forma de pago");
            }
        }

        public async Task<ErrorOr<FormaPagoResponse>> CreateAsync(CreateFormaPagoRequest request)
        {
            try
            {
                var existeNombre = await _formaPagoRepository.ExistsAsync(s => s.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("FormaPago", "nombre", request.Nombre);
                }

                var formaPago = new FormaPago
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Clave = request.Clave,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _formaPagoRepository.AddAsync(formaPago);
                EnrichWideEvent(action: "Create", entityId: result.IdFormaPago, nombre: result.Nombre);
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
                return CommonErrors.DatabaseError($"guardar la forma de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al crear la forma de pago.");
            }
        }

        public async Task<ErrorOr<FormaPagoResponse>> UpdateAsync(int id, UpdateFormaPagoRequest request)
        {
            try
            {
                var formaPago = await _formaPagoRepository.GetByIdAsync(id);
                if (formaPago == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("FormaPago", id.ToString());
                }

                var existeNombre = await _formaPagoRepository.ExistsAsync(s => s.Nombre == request.Nombre && s.IdFormaPago != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("FormaPago", "nombre", request.Nombre);
                }

                formaPago.Nombre = request.Nombre.Trim();
                formaPago.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                formaPago.Descripcion = request.Descripcion;
                formaPago.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                formaPago.Clave = request.Clave;
                formaPago.FechaModificacion = DateTime.UtcNow;
                formaPago.Activo = request.Activo;

                var result = await _formaPagoRepository.UpdateAsync(formaPago);
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
                return CommonErrors.ConcurrencyError("FormaPago");
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }
                EnrichWideEvent(action: "Update", entityId: id, error: errorMessage);
                return CommonErrors.DatabaseError($"actualizar la forma de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la forma de pago.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var formaPago = await _formaPagoRepository.GetByIdAsync(id);
                if (formaPago == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("FormaPago", id.ToString());
                }

                var eliminado = await _formaPagoRepository.DeleteAsync(formaPago);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("FormaPago");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: formaPago.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.HasDependencies("FormaPago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la forma de pago.");
            }
        }
    }
}
