using Azure;
using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Sucursales.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.Sucursales
{
public class SucursalService : BaseService, ISucursalService
    {
        private readonly ISucursalRepository _sucursalRepository;
        private readonly IEmpresaRepository _empresaRepository;
        private readonly ILogger<SucursalService> _logger;
        protected override string EntityName => "Sucursal";

        public SucursalService(
            ISucursalRepository sucursalRepository,
            IEmpresaRepository empresaRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<SucursalService> logger)
            : base(wideEventAccessor)
        {
            _sucursalRepository = sucursalRepository;
            _empresaRepository = empresaRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<SucursalResponse>>> GetAllAsync(SucursalRequest query)
        {
            try
            {
                var queryable = _sucursalRepository.GetQueryable();

                if (query.IdEmpresa.HasValue)
                    queryable = queryable.Where(s => s.IdEmpresa == query.IdEmpresa.Value);

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(s => s.Nombre.Contains(query.Nombre));

                if (!string.IsNullOrWhiteSpace(query.Ciudad))
                    queryable = queryable.Where(s => s.Ciudad.Contains(query.Ciudad));

                if (!string.IsNullOrWhiteSpace(query.Estado))
                    queryable = queryable.Where(s => s.Estado.Contains(query.Estado));

                if (query.Activo.HasValue)
                    queryable = queryable.Where(s => s.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(s => s.Nombre),
                    ("ciudad", "asc") => queryable.OrderBy(s => s.Ciudad),
                    ("ciudad", "desc") => queryable.OrderByDescending(s => s.Ciudad),
                    ("estado", "asc") => queryable.OrderBy(s => s.Estado),
                    ("estado", "desc") => queryable.OrderByDescending(s => s.Estado),
                    ("fechacreacion", "asc") => queryable.OrderBy(s => s.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(s => s.FechaCreacion),
                    _ => queryable.OrderBy(s => s.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.IdEmpresa, query.Nombre, query.Ciudad, query.Estado, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<SucursalResponse>();
                }

                var response = result.Select(s => s.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.IdEmpresa, query.Nombre, query.Ciudad, query.Estado, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(s => s.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener las sucursales");
            }
        }

        public async Task<ErrorOr<SucursalResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _sucursalRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("sucursal", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"obtener la sucursal");
            }
        }

        public async Task<ErrorOr<SucursalResponse>> CreateAsync(CreateSucursalRequest request)
        {
            try
            {
                var empresaExiste = await _empresaRepository.ExistsAsync(e => e.IdEmpresa == request.IdEmpresa);
                if (!empresaExiste)
                {
                    EnrichWideEvent(action: "Create", entityId: request.IdEmpresa, notFound: true);
                    return CommonErrors.NotFound("empresa", request.IdEmpresa.ToString());
                }

                var existeNombre = await _sucursalRepository.ExistsAsync(s => s.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("sucursal", "nombre", request.Nombre);
                }

                var sucursal = new Sucursal
                {
                    IdEmpresa = request.IdEmpresa,
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Clave = request.Clave,
                    ClaveContable = request.ClaveContable,
                    Direccion = request.Direccion,
                    CodigoPostal = request.CodigoPostal,
                    Ciudad = request.Ciudad,
                    Estado = request.Estado,
                    Telefono = request.Telefono,
                    Latitud = request.Latitud,
                    Longitud = request.Longitud,
                    NumeroEmpleados = request.NumeroEmpleados ?? 0,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _sucursalRepository.AddAsync(sucursal);
                EnrichWideEvent(action: "Create", entityId: result.IdSucursal, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError($"guardar la sucursal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al crear la sucursal.");
            }
        }

        public async Task<ErrorOr<SucursalResponse>> UpdateAsync(int id, UpdateSucursalRequest request)
        {
            try
            {
                var empresaExiste = await _empresaRepository.ExistsAsync(e => e.IdEmpresa == request.IdEmpresa);
                if (!empresaExiste)
                {
                    EnrichWideEvent(action: "Update", entityId: request.IdEmpresa, notFound: true);
                    return CommonErrors.NotFound("empresa", request.IdEmpresa.ToString());
                }

                var sucursal = await _sucursalRepository.GetByIdAsync(id);
                if (sucursal == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("sucursal", id.ToString());
                }

                var existeNombre = await _sucursalRepository.ExistsAsync(s => s.Nombre == request.Nombre && s.IdSucursal != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("sucursal", "nombre", request.Nombre);
                }

                sucursal.Nombre = request.Nombre.Trim();
                sucursal.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                sucursal.Descripcion = request.Descripcion;
                sucursal.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                sucursal.Clave = request.Clave;
                sucursal.ClaveContable = request.ClaveContable;
                sucursal.Direccion = request.Direccion;
                sucursal.CodigoPostal = request.CodigoPostal;
                sucursal.Ciudad = request.Ciudad;
                sucursal.Estado = request.Estado;
                sucursal.Telefono = request.Telefono;
                sucursal.Latitud = request.Latitud;
                sucursal.Longitud = request.Longitud;
                sucursal.NumeroEmpleados = request.NumeroEmpleados ?? 0;
                sucursal.Activo = request.Activo;
                sucursal.FechaModificacion = DateTime.UtcNow;

                var result = await _sucursalRepository.UpdateAsync(sucursal);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.ConcurrencyError("sucursal");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"actualizar la sucursal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la sucursal.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var sucursal = await _sucursalRepository.GetByIdAsync(id);
                if (sucursal == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("sucursal", id.ToString());
                }

                var eliminado = await _sucursalRepository.DeleteAsync(sucursal);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("sucursal");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: sucursal.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"eliminar la sucursal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la sucursal.");
            }
        }


    }
}
