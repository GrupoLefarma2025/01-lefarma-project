using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Bancos.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.Bancos
{
    public class BancoService : BaseService, IBancoService
    {
        private readonly IBancoRepository _bancoRepository;
        private readonly ILogger<BancoService> _logger;
        protected override string EntityName => "Banco";

        public BancoService(
            IBancoRepository bancoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<BancoService> logger)
            : base(wideEventAccessor)
        {
            _bancoRepository = bancoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<BancoResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _bancoRepository.GetAllAsync();
                if (result == null || !result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0);
                    return CommonErrors.NotFound("Bancos");
                }

                var response = result
                    .Where(b => !string.IsNullOrWhiteSpace(b.Nombre))
                    .Select(b => b.ToResponse())
                    .OrderBy(b => b.Nombre)
                    .ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, items: response.Select(b => b.Nombre).ToList());
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.Message);
                return CommonErrors.DatabaseError("obtener los bancos");
            }
        }

        public async Task<ErrorOr<BancoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _bancoRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("banco", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError("obtener el banco");
            }
        }

        public async Task<ErrorOr<BancoResponse>> CreateAsync(CreateBancoRequest request)
        {
            try
            {
                var existeNombre = await _bancoRepository.ExistsAsync(b => b.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("banco", "nombre", request.Nombre);
                }

                var banco = new Banco
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Clave = request.Clave,
                    CodigoSWIFT = request.CodigoSWIFT,
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _bancoRepository.AddAsync(banco);
                EnrichWideEvent(action: "Create", entityId: result.IdBanco, nombre: result.Nombre);
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
                return CommonErrors.DatabaseError("guardar el banco");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.InternalServerError("Error inesperado al crear el banco.");
            }
        }

        public async Task<ErrorOr<BancoResponse>> UpdateAsync(int id, UpdateBancoRequest request)
        {
            try
            {
                var banco = await _bancoRepository.GetByIdAsync(id);
                if (banco == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("banco", id.ToString());
                }

                var existeNombre = await _bancoRepository.ExistsAsync(b => b.Nombre == request.Nombre && b.IdBanco != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("banco", "nombre", request.Nombre);
                }

                banco.Nombre = request.Nombre.Trim();
                banco.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                banco.Clave = request.Clave;
                banco.CodigoSWIFT = request.CodigoSWIFT;
                banco.Descripcion = request.Descripcion;
                banco.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                banco.FechaModificacion = DateTime.UtcNow;
                banco.Activo = request.Activo;

                var result = await _bancoRepository.UpdateAsync(banco);
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
                return CommonErrors.ConcurrencyError("banco");
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";

                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }

                EnrichWideEvent(action: "Update", entityId: id, error: errorMessage);
                return CommonErrors.DatabaseError("actualizar el banco");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError("Error inesperado al actualizar el banco.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var banco = await _bancoRepository.GetByIdAsync(id);
                if (banco == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("banco", id.ToString());
                }

                var eliminado = await _bancoRepository.DeleteAsync(banco);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("banco");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: banco.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError("eliminar el banco");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError("Error inesperado al eliminar el banco.");
            }
        }
    }
}
