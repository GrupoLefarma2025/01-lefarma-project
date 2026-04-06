using Azure;
using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
using Lefarma.API.Features.Catalogos.Proveedores.Extensions;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.Proveedores
{
public class ProveedorService : BaseService, IProveedorService
    {
        private readonly IProveedorRepository _proveedorRepository;
        private readonly IRegimenFiscalRepository _regimenFiscalRepository;
        private readonly ILogger<ProveedorService> _logger;
        protected override string EntityName => "Proveedor";

        public ProveedorService(
            IProveedorRepository proveedorRepository,
            IRegimenFiscalRepository regimenFiscalRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<ProveedorService> logger)
            : base(wideEventAccessor)
        {
            _proveedorRepository = proveedorRepository;
            _regimenFiscalRepository = regimenFiscalRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<ProveedorResponse>>> GetAllAsync(ProveedorRequest query)
        {
            try
            {
                var queryable = _proveedorRepository.GetQueryable();

                if (!string.IsNullOrWhiteSpace(query.RazonSocial))
                    queryable = queryable.Where(p => p.RazonSocial.Contains(query.RazonSocial));

                if (!string.IsNullOrWhiteSpace(query.RFC))
                    queryable = queryable.Where(p => p.RFC != null && p.RFC.Contains(query.RFC));

                if (query.AutorizadoPorCxP.HasValue)
                    queryable = queryable.Where(p => p.AutorizadoPorCxP == query.AutorizadoPorCxP.Value);

                if (query.SinDatosFiscales.HasValue)
                    queryable = queryable.Where(p => p.SinDatosFiscales == query.SinDatosFiscales.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("razonsocial", "desc") => queryable.OrderByDescending(p => p.RazonSocial),
                    ("rfc", "asc") => queryable.OrderBy(p => p.RFC ?? ""),
                    ("rfc", "desc") => queryable.OrderByDescending(p => p.RFC ?? ""),
                    ("fecharegistro", "asc") => queryable.OrderBy(p => p.FechaRegistro),
                    ("fecharegistro", "desc") => queryable.OrderByDescending(p => p.FechaRegistro),
                    _ => queryable.OrderBy(p => p.RazonSocial)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.RazonSocial, query.RFC, query.AutorizadoPorCxP, query.SinDatosFiscales, query.OrderBy, query.OrderDirection }
                    });
                    return new List<ProveedorResponse>();
                }

                var response = result.Select(p => p.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.RazonSocial, query.RFC, query.AutorizadoPorCxP, query.SinDatosFiscales, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(p => p.RazonSocial).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("obtener los proveedores");
            }
        }

        public async Task<ErrorOr<ProveedorResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _proveedorRepository.GetByIdAsync(id);

                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("proveedor", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.RazonSocial);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"obtener el proveedor");
            }
        }

        public async Task<ErrorOr<ProveedorResponse>> CreateAsync(CreateProveedorRequest request)
        {
            try
            {
                var existeRazonSocial = await _proveedorRepository.ExistsAsync(p => p.RazonSocial == request.RazonSocial);
                if (existeRazonSocial)
                {
                    EnrichWideEvent(action: "Create", nombre: request.RazonSocial, duplicate: true);
                    return CommonErrors.AlreadyExists("proveedor", "razón social", request.RazonSocial);
                }

                if (!string.IsNullOrWhiteSpace(request.RFC))
                {
                    var existeRFC = await _proveedorRepository.ExistsAsync(p => p.RFC == request.RFC);
                    if (existeRFC)
                    {
                        EnrichWideEvent(action: "Create", nombre: request.RFC, duplicate: true);
                        return CommonErrors.AlreadyExists("proveedor", "RFC", request.RFC);
                    }
                }

                if (request.RegimenFiscalId.HasValue)
                {
                    var regimenFiscalExiste = await _regimenFiscalRepository.ExistsAsync(r => r.IdRegimenFiscal == request.RegimenFiscalId.Value);
                    if (!regimenFiscalExiste)
                    {
                        EnrichWideEvent(action: "Create", entityId: request.RegimenFiscalId.Value, notFound: true);
                        return CommonErrors.NotFound("régimen fiscal", request.RegimenFiscalId.Value.ToString());
                    }
                }

                var newProveedor = new Proveedor
                {
                    RazonSocial = request.RazonSocial,
                    RazonSocialNormalizada = StringExtensions.RemoveDiacritics(request.RazonSocial),
                    RFC = request.RFC,
                    CodigoPostal = request.CodigoPostal,
                    RegimenFiscalId = request.RegimenFiscalId,
                    PersonaContacto = request.PersonaContacto,
                    NotaFormaPago = request.NotaFormaPago,
                    NotasGenerales = request.NotasGenerales,
                    SinDatosFiscales = request.SinDatosFiscales,
                    AutorizadoPorCxP = request.AutorizadoPorCxP,
                    FechaRegistro = DateTime.UtcNow
                };

                var result = await _proveedorRepository.AddAsync(newProveedor);
                EnrichWideEvent(action: "Create", entityId: result.IdProveedor, nombre: result.RazonSocial);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.RazonSocial, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"guardar el proveedor");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.RazonSocial, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al crear el proveedor.");
            }
        }

        public async Task<ErrorOr<ProveedorResponse>> UpdateAsync(int id, UpdateProveedorRequest request)
        {
            try
            {
                var proveedor = await _proveedorRepository.GetByIdAsync(id);
                if (proveedor == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("proveedor", id.ToString());
                }

                var existeRazonSocial = await _proveedorRepository.ExistsAsync(p => p.RazonSocial == request.RazonSocial && p.IdProveedor != id);
                if (existeRazonSocial)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.RazonSocial, duplicate: true);
                    return CommonErrors.AlreadyExists("proveedor", "razón social", request.RazonSocial);
                }

                if (!string.IsNullOrWhiteSpace(request.RFC))
                {
                    var existeRFC = await _proveedorRepository.ExistsAsync(p => p.RFC == request.RFC && p.IdProveedor != id);
                    if (existeRFC)
                    {
                        EnrichWideEvent(action: "Update", entityId: id, nombre: request.RFC, duplicate: true);
                        return CommonErrors.AlreadyExists("proveedor", "RFC", request.RFC);
                    }
                }

                if (request.RegimenFiscalId.HasValue)
                {
                    var regimenFiscalExiste = await _regimenFiscalRepository.ExistsAsync(r => r.IdRegimenFiscal == request.RegimenFiscalId.Value);
                    if (!regimenFiscalExiste)
                    {
                        EnrichWideEvent(action: "Update", entityId: request.RegimenFiscalId.Value, notFound: true);
                        return CommonErrors.NotFound("régimen fiscal", request.RegimenFiscalId.Value.ToString());
                    }
                }

                proveedor.RazonSocial = request.RazonSocial;
                proveedor.RazonSocialNormalizada = StringExtensions.RemoveDiacritics(request.RazonSocial);
                proveedor.RFC = request.RFC;
                proveedor.CodigoPostal = request.CodigoPostal;
                proveedor.RegimenFiscalId = request.RegimenFiscalId;
                proveedor.PersonaContacto = request.PersonaContacto;
                proveedor.NotaFormaPago = request.NotaFormaPago;
                proveedor.NotasGenerales = request.NotasGenerales;
                proveedor.SinDatosFiscales = request.SinDatosFiscales;
                proveedor.AutorizadoPorCxP = request.AutorizadoPorCxP;
                proveedor.FechaModificacion = DateTime.UtcNow;

                var result = await _proveedorRepository.UpdateAsync(proveedor);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.RazonSocial);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.ConcurrencyError("proveedor");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"actualizar el proveedor");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el proveedor.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var proveedor = await _proveedorRepository.GetByIdAsync(id);
                if (proveedor == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("proveedor", id.ToString());
                }

                var eliminado = await _proveedorRepository.DeleteAsync(proveedor);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("proveedor");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: proveedor.RazonSocial);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"eliminar el proveedor");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el proveedor.");
            }
        }

        public async Task<ErrorOr<ProveedorResponse>> AutorizarAsync(int id)
        {
            try
            {
                var proveedor = await _proveedorRepository.GetByIdAsync(id);
                if (proveedor == null)
                {
                    EnrichWideEvent(action: "Autorizar", entityId: id, notFound: true);
                    return CommonErrors.NotFound("proveedor", id.ToString());
                }

                if (proveedor.AutorizadoPorCxP)
                {
                    EnrichWideEvent(action: "Autorizar", entityId: id, nombre: proveedor.RazonSocial, additionalContext: new Dictionary<string, object> { ["reason"] = "already_authorized" });
                    return CommonErrors.AlreadyExists("proveedor", "autorización", id.ToString());
                }

                proveedor.AutorizadoPorCxP = true;
                proveedor.FechaModificacion = DateTime.UtcNow;

                var result = await _proveedorRepository.UpdateAsync(proveedor);
                EnrichWideEvent(action: "Autorizar", entityId: id, nombre: result.RazonSocial);
                return result.ToResponse();
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Autorizar", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("autorizar el proveedor");
            }
        }

        public async Task<ErrorOr<ProveedorResponse>> RechazarAsync(int id, string motivo)
        {
            try
            {
                var proveedor = await _proveedorRepository.GetByIdAsync(id);
                if (proveedor == null)
                {
                    EnrichWideEvent(action: "Rechazar", entityId: id, notFound: true);
                    return CommonErrors.NotFound("proveedor", id.ToString());
                }

                proveedor.AutorizadoPorCxP = false;
                proveedor.NotasGenerales = string.IsNullOrWhiteSpace(motivo)
                    ? proveedor.NotasGenerales
                    : $"[RECHAZADO] {motivo}";
                proveedor.FechaModificacion = DateTime.UtcNow;

                var result = await _proveedorRepository.UpdateAsync(proveedor);
                EnrichWideEvent(action: "Rechazar", entityId: id, nombre: result.RazonSocial);
                return result.ToResponse();
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Rechazar", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("rechazar el proveedor");
            }
        }
    }
}
