using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Empresas.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.Empresas
{
    public class EmpresaService : BaseService, IEmpresaService
    {
        private readonly IEmpresaRepository _empresaRepository;
        private readonly ILogger<EmpresaService> _logger;
        protected override string EntityName => "Empresa";

        public EmpresaService(
            IEmpresaRepository empresaRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<EmpresaService> logger)
            : base(wideEventAccessor)
        {
            _empresaRepository = empresaRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<EmpresaResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _empresaRepository.GetAllAsync();
                if (result == null || !result.Any())
                {
                    //_logger.LogDebug("No se encontraron empresas");
                    EnrichWideEvent(action: "GetAll", count: 0);
                    return CommonErrors.NotFound("Empresas");
                }

                var response = result
                    .Where(e => !string.IsNullOrWhiteSpace(e.Nombre))
                    .Select(e => e.ToResponse())
                    .OrderBy(e => e.Nombre)
                    .ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, items: response.Select(e => e.Nombre).ToList());
                return response;
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Error al obtener las empresas");
                EnrichWideEvent(action: "GetAll", error: ex.Message);
                return CommonErrors.DatabaseError("obtener las empresas");
            }
        }

        public async Task<ErrorOr<EmpresaResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _empresaRepository.GetByIdAsync(id);
                if (result == null)
                {
                    //_logger.LogWarning("Empresa con ID {EmpresaId} no encontrada", id);
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("empresa", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Error al obtener empresa {EmpresaId}", id);
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"obtener la empresa");
            }
        }

        public async Task<ErrorOr<EmpresaResponse>> CreateAsync(CreateEmpresaRequest request)
        {
            try
            {
                var existeNombre = await _empresaRepository.ExistsAsync(s => s.Nombre == request.Nombre);
                if (existeNombre)
                {
                    //_logger.LogWarning("Intento de crear empresa con nombre duplicado: {EmpresaNombre}", request.Nombre);
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("empresa", "nombre", request.Nombre);
                }

                var empresa = new Empresa
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Clave = request.Clave,
                    RazonSocial = request.RazonSocial,
                    RFC = request.RFC,
                    Direccion = request.Direccion,
                    Colonia = request.Colonia,
                    Ciudad = request.Ciudad,
                    Estado = request.Estado,
                    CodigoPostal = request.CodigoPostal,
                    Telefono = request.Telefono,
                    Email = request.Email,
                    PaginaWeb = request.PaginaWeb,
                    NumeroEmpleados = request.NumeroEmpleados,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _empresaRepository.AddAsync(empresa);
                EnrichWideEvent(action: "Create", entityId: result.IdEmpresa, nombre: result.Nombre);
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
                return CommonErrors.DatabaseError($"guardar la empresa");
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Error inesperado al crear empresa: {EmpresaNombre}", request.Nombre);
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al crear la empresa.");
            }
        }

        public async Task<ErrorOr<EmpresaResponse>> UpdateAsync(int id, UpdateEmpresaRequest request)
        {
            try
            {
                var empresa = await _empresaRepository.GetByIdAsync(id);
                if (empresa == null)
                {
                    //_logger.LogWarning("Intento de actualizar empresa inexistente: {EmpresaId}", id);
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("empresa", id.ToString());
                }

                var existeNombre = await _empresaRepository.ExistsAsync(s => s.Nombre == request.Nombre && s.IdEmpresa != id);
                if (existeNombre)
                {
                    //_logger.LogWarning("Intento de actualizar empresa con nombre duplicado: {EmpresaNombre}", request.Nombre);
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("empresa", "nombre", request.Nombre);
                }

                empresa.Nombre = request.Nombre.Trim();
                empresa.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                empresa.RazonSocial = request.RazonSocial;
                empresa.Descripcion = request.Descripcion;
                empresa.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                empresa.Clave = request.Clave;
                empresa.RFC = request.RFC;
                empresa.Direccion = request.Direccion;
                empresa.Colonia = request.Colonia;
                empresa.Ciudad = request.Ciudad;
                empresa.Estado = request.Estado;
                empresa.CodigoPostal = request.CodigoPostal;
                empresa.Telefono = request.Telefono;
                empresa.Email = request.Email;
                empresa.PaginaWeb = request.PaginaWeb;
                empresa.NumeroEmpleados = request.NumeroEmpleados;
                empresa.FechaModificacion = DateTime.UtcNow;
                empresa.Activo = request.Activo;

                var result = await _empresaRepository.UpdateAsync(empresa);
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

                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: errorMessage);
                return CommonErrors.ConcurrencyError("empresa");
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";

                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }

                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: errorMessage);
                return CommonErrors.DatabaseError($"actualizar la empresa");
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Error inesperado al actualizar empresa: {EmpresaId}", id);
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la empresa.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var empresa = await _empresaRepository.GetByIdAsync(id);
                if (empresa == null)
                {
                    //_logger.LogWarning("Intento de eliminar empresa inexistente: {EmpresaId}", id);
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("empresa", id.ToString());
                }

                var eliminado = await _empresaRepository.DeleteAsync(empresa);
                if (!eliminado)
                {
                    //_logger.LogWarning("No se pudo eliminar empresa: {EmpresaId}", id);
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("empresa");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: empresa.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                //_logger.LogError(ex, "Error de base de datos al eliminar empresa: {EmpresaId}", id);
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"eliminar la empresa");
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Error inesperado al eliminar empresa: {EmpresaId}", id);
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la empresa.");
            }
        }
    }
}
