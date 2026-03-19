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

        public async Task<ErrorOr<IEnumerable<AreaResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _areaRepository.GetAllAsync();
                if (result == null)//!result.Any()
                {
                    EnrichWideEvent(action: "GetAll", count: 0);
                    return CommonErrors.NotFound("Sucursales");
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
                EnrichWideEvent(action: "GetAll", error: ex.Message);
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
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
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
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.DatabaseError($"guardar el area");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
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
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.ConcurrencyError("area");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"actualizar el area");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
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
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"eliminar el area");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el area.");
            }
        }
    }
}
