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

namespace Lefarma.API.Features.Catalogos.Proveedores;

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
            var baseQuery = _proveedorRepository.GetQueryable();

            if (!string.IsNullOrWhiteSpace(query.RazonSocial))
                baseQuery = baseQuery.Where(p => p.RazonSocial.Contains(query.RazonSocial));

            if (!string.IsNullOrWhiteSpace(query.RFC))
                baseQuery = baseQuery.Where(p => p.RFC != null && p.RFC.Contains(query.RFC));

            var orderedQuery = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
            {
                ("razonsocial", "desc") => baseQuery.OrderByDescending(p => p.RazonSocial),
                ("rfc", "asc") => baseQuery.OrderBy(p => p.RFC ?? ""),
                ("rfc", "desc") => baseQuery.OrderByDescending(p => p.RFC ?? ""),
                ("fecharegistro", "asc") => baseQuery.OrderBy(p => p.FechaRegistro),
                ("fecharegistro", "desc") => baseQuery.OrderByDescending(p => p.FechaRegistro),
                _ => baseQuery.OrderBy(p => p.RazonSocial)
            };

            var result = await orderedQuery
                .Include(p => p.RegimenFiscal!)
                .Include(p => p.Detalle)
                .Include(p => p.CuentasFormaPago)
                    .ThenInclude(c => c.FormaPago)
                .Include(p => p.CuentasFormaPago)
                    .ThenInclude(c => c.Banco)
                .ToListAsync();

            if (!result.Any())
            {
                EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.RazonSocial, query.RFC, query.OrderBy, query.OrderDirection }
                });
                return new List<ProveedorResponse>();
            }

            var response = result.Select(p => p.ToResponse()).ToList();

            EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
            {
                ["filters"] = new { query.RazonSocial, query.RFC, query.OrderBy, query.OrderDirection },
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
                var result = await _proveedorRepository.GetByIdWithDetailsAsync(id);

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
                UsoCfdi = request.UsoCfdi,
                SinDatosFiscales = request.SinDatosFiscales,
                FechaRegistro = DateTime.UtcNow,
                Detalle = request.Detalle != null ? new ProveedorDetalle
                {
                    PersonaContactoNombre = request.Detalle.PersonaContactoNombre,
                    ContactoTelefono = request.Detalle.ContactoTelefono,
                    ContactoEmail = request.Detalle.ContactoEmail,
                    FechaCreacion = DateTime.UtcNow
                } : null
            };

            if (request.CuentasFormaPago != null && request.CuentasFormaPago.Any())
            {
                foreach (var cuenta in request.CuentasFormaPago)
                {
                    newProveedor.CuentasFormaPago.Add(new ProveedorFormaPagoCuenta
                    {
                        IdFormaPago = cuenta.IdFormaPago,
                        IdBanco = cuenta.IdBanco,
                        NumeroCuenta = cuenta.NumeroCuenta,
                        Clabe = cuenta.Clabe,
                        NumeroTarjeta = cuenta.NumeroTarjeta,
                        Beneficiario = cuenta.Beneficiario,
                        CorreoNotificacion = cuenta.CorreoNotificacion,
                        FechaCreacion = DateTime.UtcNow
                    });
                }
            }

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
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
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
            proveedor.UsoCfdi = request.UsoCfdi;
            proveedor.SinDatosFiscales = request.SinDatosFiscales;
            proveedor.FechaModificacion = DateTime.UtcNow;

            if (request.Detalle != null && proveedor.Detalle != null)
            {
                proveedor.Detalle.PersonaContactoNombre = request.Detalle.PersonaContactoNombre;
                proveedor.Detalle.ContactoTelefono = request.Detalle.ContactoTelefono;
                proveedor.Detalle.ContactoEmail = request.Detalle.ContactoEmail;
                proveedor.Detalle.FechaModificacion = DateTime.UtcNow;
            }

            // Actualizar cuentas: eliminar existentes y crear las nuevas
            if (request.CuentasFormaPago != null)
            {
                var cuentasExistentes = proveedor.CuentasFormaPago.ToList();
                foreach (var cuenta in cuentasExistentes)
                {
                    _proveedorRepository.RemoveCuenta(cuenta);
                }

                foreach (var cuenta in request.CuentasFormaPago)
                {
                    proveedor.CuentasFormaPago.Add(new ProveedorFormaPagoCuenta
                    {
                        IdProveedor = proveedor.IdProveedor,
                        IdFormaPago = cuenta.IdFormaPago,
                        IdBanco = cuenta.IdBanco,
                        NumeroCuenta = cuenta.NumeroCuenta,
                        Clabe = cuenta.Clabe,
                        NumeroTarjeta = cuenta.NumeroTarjeta,
                        Beneficiario = cuenta.Beneficiario,
                        CorreoNotificacion = cuenta.CorreoNotificacion,
                        FechaCreacion = DateTime.UtcNow
                    });
                }
            }

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
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
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

    public async Task<ErrorOr<ProveedorResponse>> AutorizarAsync(int id, int idUsuario)
    {
        try
        {
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "Autorizar", entityId: id, notFound: true);
                return CommonErrors.NotFound("proveedor", id.ToString());
            }

            if (proveedor.Estatus == EstatusProveedor.Aprobado)
                return Error.Conflict("El proveedor ya está aprobado");

            if (proveedor.Estatus == EstatusProveedor.Rechazado)
                return Error.Conflict("El proveedor está rechazado y no se puede aprobar");

            proveedor.Estatus = EstatusProveedor.Aprobado;
            proveedor.CambioEstatusPor = idUsuario;
            proveedor.FechaModificacion = DateTime.UtcNow;

            await _proveedorRepository.UpdateAsync(proveedor);

            _logger.LogInformation("Proveedor {Id} aprobado por usuario {Usuario}", id, idUsuario);

            EnrichWideEvent(action: "Autorizar", entityId: id, nombre: proveedor.RazonSocial);
            return proveedor.ToResponse();
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "Autorizar", entityId: id, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("aprobar el proveedor");
        }
    }

    public async Task<ErrorOr<ProveedorResponse>> RechazarAsync(int id, string motivo, int idUsuario)
    {
        try
        {
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "Rechazar", entityId: id, notFound: true);
                return CommonErrors.NotFound("proveedor", id.ToString());
            }

            if (proveedor.Estatus == EstatusProveedor.Rechazado)
                return Error.Conflict("El proveedor ya está rechazado");

            if (proveedor.Estatus == EstatusProveedor.Aprobado)
                return Error.Conflict("El proveedor está aprobado y no se puede rechazar");

            proveedor.Estatus = EstatusProveedor.Rechazado;
            proveedor.CambioEstatusPor = idUsuario;
            proveedor.FechaModificacion = DateTime.UtcNow;

            if (proveedor.Detalle != null)
            {
                proveedor.Detalle.Comentario = motivo;
                proveedor.Detalle.FechaModificacion = DateTime.UtcNow;
            }

            await _proveedorRepository.UpdateAsync(proveedor);

            _logger.LogInformation("Proveedor {Id} rechazado por usuario {Usuario}: {Motivo}", id, idUsuario, motivo);

            EnrichWideEvent(action: "Rechazar", entityId: id, nombre: proveedor.RazonSocial);
            return proveedor.ToResponse();
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "Rechazar", entityId: id, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("rechazar el proveedor");
        }
    }
}
