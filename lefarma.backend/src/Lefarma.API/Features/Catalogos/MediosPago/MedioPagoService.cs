using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.MediosPago.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.MediosPago
{
public class MedioPagoService : BaseService, IMedioPagoService
    {
        private readonly IMedioPagoRepository _medioPagoRepository;
        private readonly ILogger<MedioPagoService> _logger;
        protected override string EntityName => "MedioPago";

        public MedioPagoService(
            IMedioPagoRepository medioPagoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<MedioPagoService> logger)
            : base(wideEventAccessor)
        {
            _medioPagoRepository = medioPagoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<MedioPagoResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _medioPagoRepository.GetAllAsync();

                var response = (result ?? [])
                    .Where(m => !string.IsNullOrWhiteSpace(m.Nombre))
                    .Select(m => m.ToResponse())
                    .OrderBy(m => m.Nombre)
                    .ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, items: response.Select(m => m.Nombre).ToList());
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.Message);
                return CommonErrors.DatabaseError("obtener los medios de pago");
            }
        }

        public async Task<ErrorOr<MedioPagoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _medioPagoRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("MedioPago", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"obtener el medio de pago");
            }
        }

        public async Task<ErrorOr<MedioPagoResponse>> CreateAsync(CreateMedioPagoRequest request)
        {
            try
            {
                var existeNombre = await _medioPagoRepository.ExistsAsync(m => m.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("MedioPago", "nombre", request.Nombre);
                }

                var medioPago = new MedioPago
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Clave = request.Clave,
                    CodigoSAT = request.CodigoSAT,
                    RequiereReferencia = request.RequiereReferencia,
                    RequiereAutorizacion = request.RequiereAutorizacion,
                    LimiteMonto = request.LimiteMonto,
                    PlazoMaximoDias = request.PlazoMaximoDias,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _medioPagoRepository.AddAsync(medioPago);
                EnrichWideEvent(action: "Create", entityId: result.IdMedioPago, nombre: result.Nombre);
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
                return CommonErrors.DatabaseError($"guardar el medio de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al crear el medio de pago.");
            }
        }

        public async Task<ErrorOr<MedioPagoResponse>> UpdateAsync(int id, UpdateMedioPagoRequest request)
        {
            try
            {
                var medioPago = await _medioPagoRepository.GetByIdAsync(id);
                if (medioPago == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("MedioPago", id.ToString());
                }

                var existeNombre = await _medioPagoRepository.ExistsAsync(m => m.Nombre == request.Nombre && m.IdMedioPago != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("MedioPago", "nombre", request.Nombre);
                }

                medioPago.Nombre = request.Nombre.Trim();
                medioPago.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                medioPago.Descripcion = request.Descripcion;
                medioPago.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                medioPago.Clave = request.Clave;
                medioPago.CodigoSAT = request.CodigoSAT;
                medioPago.RequiereReferencia = request.RequiereReferencia;
                medioPago.RequiereAutorizacion = request.RequiereAutorizacion;
                medioPago.LimiteMonto = request.LimiteMonto;
                medioPago.PlazoMaximoDias = request.PlazoMaximoDias;
                medioPago.FechaModificacion = DateTime.UtcNow;
                medioPago.Activo = request.Activo;

                var result = await _medioPagoRepository.UpdateAsync(medioPago);
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

                EnrichWideEvent(action: "Update", nombre: request.Nombre, error: errorMessage);
                return CommonErrors.ConcurrencyError("MedioPago");
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";

                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }

                EnrichWideEvent(action: "Update", nombre: request.Nombre, error: errorMessage);
                return CommonErrors.DatabaseError($"actualizar el medio de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el medio de pago.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var medioPago = await _medioPagoRepository.GetByIdAsync(id);
                if (medioPago == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("MedioPago", id.ToString());
                }

                var eliminado = await _medioPagoRepository.DeleteAsync(medioPago);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("MedioPago");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: medioPago.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.HasDependencies("MedioPago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el medio de pago.");
            }
        }
    }
}
