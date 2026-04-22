using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
using Lefarma.API.Features.Catalogos.Proveedores.Extensions;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.Proveedores;

public class ProveedorService : BaseService, IProveedorService
{
    private readonly IProveedorRepository _proveedorRepository;
    private readonly IRegimenFiscalRepository _regimenFiscalRepository;
    private readonly ILogger<ProveedorService> _logger;
    private readonly IConfiguration _configuration;
    private readonly ApplicationDbContext _dbContext;
    protected override string EntityName => "Proveedor";

    public ProveedorService(
        IProveedorRepository proveedorRepository,
        IRegimenFiscalRepository regimenFiscalRepository,
        IWideEventAccessor wideEventAccessor,
        ILogger<ProveedorService> logger,
        IConfiguration configuration,
        ApplicationDbContext dbContext)
        : base(wideEventAccessor)
    {
        _proveedorRepository = proveedorRepository;
        _regimenFiscalRepository = regimenFiscalRepository;
        _logger = logger;
        _configuration = configuration;
        _dbContext = dbContext;
    }

    public async Task<ErrorOr<IEnumerable<ProveedorResponse>>> GetAllAsync(ProveedorRequest query)
    {
        try
        {
            var baseQuery = _proveedorRepository.GetQueryable();

            // Si se especifica estatus, filtrar por ese valor
            if (query.Estatus.HasValue)
                baseQuery = baseQuery.Where(p => p.Estatus == query.Estatus.Value);
            // Si no se especifica estatus, se retornan todos (sin filtro por estatus)

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
                    CaratulaPath = request.Detalle.CaratulaUrl,
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

            // Solo proveedores Nuevo(1), Rechazado(3) o EditadoPendiente(4) se actualizan directamente.
            // Aprobado(2) no se toca directamente — va a staging.
            if (proveedor.Estatus == EstatusProveedor.Aprobado)
            {
                return await GuardarEnStagingAsync(proveedor, request, id);
            }

            // Validaciones comunes
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

            // Actualización directa para Nuevo, Rechazado, EditadoPendiente
            if (proveedor.Estatus == EstatusProveedor.EditadoPendiente)
            {
                return await GuardarEnStagingAsync(proveedor, request, id);
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
                if (request.Detalle.CaratulaUrl != null)
                    proveedor.Detalle.CaratulaPath = request.Detalle.CaratulaUrl;
                proveedor.Detalle.FechaModificacion = DateTime.UtcNow;
            }

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
            return CommonErrors.InternalServerError("Error inesperado al actualizar el proveedor.");
        }
    }

    /// <summary>
    /// Guarda los cambios en staging en lugar del registro original.
    /// Si ya existe staging, lo actualiza. Si no, lo crea.
    /// </summary>
    private async Task<ErrorOr<ProveedorResponse>> GuardarEnStagingAsync(Proveedor proveedor, UpdateProveedorRequest request, int id)
    {
        // Buscar staging existente para este proveedor
        var stagingExistente = await _dbContext.StagingProveedores
            .Include(s => s.Detalle)
            .Include(s => s.CuentasFormaPago)
            .FirstOrDefaultAsync(s => s.IdProveedor == id);

        StagingProveedor staging;

        if (stagingExistente != null)
        {
            // Actualizar staging existente
            staging = stagingExistente;
        }
        else
        {
            // Crear nuevo staging
            staging = new StagingProveedor
            {
                IdProveedor = id,
                FechaStaging = DateTime.UtcNow
            };
            _dbContext.StagingProveedores.Add(staging);
            await _dbContext.SaveChangesAsync();
        }

        // Copiar datos del request al staging
        staging.RazonSocial = request.RazonSocial;
        staging.RazonSocialNormalizada = StringExtensions.RemoveDiacritics(request.RazonSocial);
        staging.RFC = request.RFC;
        staging.CodigoPostal = request.CodigoPostal;
        staging.RegimenFiscalId = request.RegimenFiscalId;
        staging.UsoCfdi = request.UsoCfdi;
        staging.SinDatosFiscales = request.SinDatosFiscales;
        staging.FechaModificacion = DateTime.UtcNow;
        staging.Estatus = EstatusProveedor.EditadoPendiente;

        // Detalle
        if (request.Detalle != null)
        {
            StagingProveedorDetalle detalleStaging;
            if (staging.Detalle != null)
            {
                detalleStaging = staging.Detalle;
            }
            else
            {
                detalleStaging = new StagingProveedorDetalle
                {
                    IdStaging = staging.IdStaging,
                    IdDetalle = proveedor.Detalle?.IdDetalle ?? 0
                };
                _dbContext.StagingProveedoresDetalle.Add(detalleStaging);
            }

            detalleStaging.PersonaContactoNombre = request.Detalle.PersonaContactoNombre;
            detalleStaging.ContactoTelefono = request.Detalle.ContactoTelefono;
            detalleStaging.ContactoEmail = request.Detalle.ContactoEmail;
            detalleStaging.Comentario = request.Detalle.Comentario;
            if (request.Detalle.CaratulaUrl != null)
                detalleStaging.CaratulaPath = request.Detalle.CaratulaUrl;
            detalleStaging.FechaModificacion = DateTime.UtcNow;
        }

        // Cuentas
        if (request.CuentasFormaPago != null)
        {
            var cuentasExistentes = staging.CuentasFormaPago.ToList();
            _dbContext.StagingProveedoresFormasPagoCuentas.RemoveRange(cuentasExistentes);

            foreach (var cuenta in request.CuentasFormaPago)
            {
                staging.CuentasFormaPago.Add(new StagingProveedorFormaPagoCuenta
                {
                    IdStaging = staging.IdStaging,
                    IdFormaPago = cuenta.IdFormaPago,
                    IdBanco = cuenta.IdBanco,
                    NumeroCuenta = cuenta.NumeroCuenta,
                    Clabe = cuenta.Clabe,
                    NumeroTarjeta = cuenta.NumeroTarjeta,
                    Beneficiario = cuenta.Beneficiario,
                    CorreoNotificacion = cuenta.CorreoNotificacion,
                    Activo = true
                });
            }
        }

        // Vincular proveedor original al staging y cambiar estatus a EditadoPendiente
        proveedor.Estatus = EstatusProveedor.EditadoPendiente;
        proveedor.FechaModificacion = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        var result = await _proveedorRepository.GetByIdWithDetailsAsync(id);
        EnrichWideEvent(action: "Update → Staging", entityId: id, nombre: result?.RazonSocial);
        return result!.ToResponse();
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

    public async Task<ErrorOr<bool>> UpdateCaratulaAsync(int id, string caratulaPath)
    {
        try
        {
            // Validate caratulaPath to prevent path traversal attacks
            if (string.IsNullOrWhiteSpace(caratulaPath) || caratulaPath.Contains("..") || caratulaPath.Contains("\\"))
            {
                EnrichWideEvent(action: "UpdateCaratula", entityId: id, error: "Ruta de caratula invalida");
                return Error.Validation("La ruta de la caratula contiene caracteres invalidos");
            }

            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "UpdateCaratula", entityId: id, notFound: true);
                return CommonErrors.NotFound("proveedor", id.ToString());
            }

            if (proveedor.Detalle == null)
            {
                EnrichWideEvent(action: "UpdateCaratula", entityId: id, error: "El proveedor no tiene detalle");
                return Error.Conflict("El proveedor no tiene detalle");
            }

            proveedor.Detalle.CaratulaPath = caratulaPath;
            proveedor.Detalle.FechaModificacion = DateTime.UtcNow;

            await _proveedorRepository.UpdateAsync(proveedor);

            EnrichWideEvent(action: "UpdateCaratula", entityId: id, nombre: proveedor.RazonSocial);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdateCaratula", entityId: id, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("actualizar la caratula del proveedor");
        }
    }

    public async Task<ErrorOr<bool>> DeleteCaratulaAsync(int id)
    {
        try
        {
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "DeleteCaratula", entityId: id, notFound: true);
                return CommonErrors.NotFound("proveedor", id.ToString());
            }

            if (proveedor.Detalle == null || string.IsNullOrEmpty(proveedor.Detalle.CaratulaPath))
            {
                EnrichWideEvent(action: "DeleteCaratula", entityId: id, error: "No existe caratula");
                return Error.Conflict("No existe caratula para eliminar");
            }

            var basePath = _configuration["Archivos:BasePath"] ?? _configuration["ArchivosBasePath"] ?? "";
            var fullPath = Path.GetFullPath(Path.Combine(basePath, proveedor.Detalle.CaratulaPath));

            // Validate that the resolved fullPath is within the basePath to prevent path traversal
            var resolvedBasePath = Path.GetFullPath(basePath);
            if (!fullPath.StartsWith(resolvedBasePath))
            {
                EnrichWideEvent(action: "DeleteCaratula", entityId: id, error: "Ruta de caratula invalida");
                return Error.Validation("La ruta de la caratula esta fuera del directorio permitido");
            }

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }

            proveedor.Detalle.CaratulaPath = null;
            proveedor.Detalle.FechaModificacion = DateTime.UtcNow;

            await _proveedorRepository.UpdateAsync(proveedor);

            EnrichWideEvent(action: "DeleteCaratula", entityId: id, nombre: proveedor.RazonSocial);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "DeleteCaratula", entityId: id, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("eliminar la caratula del proveedor");
        }
    }

    public async Task<ErrorOr<ProveedorResponse>> AutorizarEdicionAsync(int id, int idUsuario)
    {
        try
        {
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "AutorizarEdicion", entityId: id, notFound: true);
                return CommonErrors.NotFound("proveedor", id.ToString());
            }

            if (proveedor.Estatus != EstatusProveedor.EditadoPendiente)
            {
                return Error.Conflict("El proveedor no tiene ediciones pendientes por autorizar");
            }

            var staging = await _dbContext.StagingProveedores
                .Include(s => s.Detalle)
                .Include(s => s.CuentasFormaPago)
                .FirstOrDefaultAsync(s => s.IdProveedor == id);

            if (staging == null)
            {
                return Error.Conflict("No se encontró el staging para este proveedor");
            }

            // Aplicar cambios del staging al proveedor original
            proveedor.RazonSocial = staging.RazonSocial;
            proveedor.RazonSocialNormalizada = staging.RazonSocialNormalizada;
            proveedor.RFC = staging.RFC;
            proveedor.CodigoPostal = staging.CodigoPostal;
            proveedor.RegimenFiscalId = staging.RegimenFiscalId;
            proveedor.UsoCfdi = staging.UsoCfdi;
            proveedor.SinDatosFiscales = staging.SinDatosFiscales;
            proveedor.FechaModificacion = DateTime.UtcNow;
            proveedor.Estatus = EstatusProveedor.Aprobado;
            proveedor.CambioEstatusPor = idUsuario;

            if (staging.Detalle != null && proveedor.Detalle != null)
            {
                proveedor.Detalle.PersonaContactoNombre = staging.Detalle.PersonaContactoNombre;
                proveedor.Detalle.ContactoTelefono = staging.Detalle.ContactoTelefono;
                proveedor.Detalle.ContactoEmail = staging.Detalle.ContactoEmail;
                proveedor.Detalle.Comentario = staging.Detalle.Comentario;
                proveedor.Detalle.CaratulaPath = staging.Detalle.CaratulaPath;
                proveedor.Detalle.FechaModificacion = DateTime.UtcNow;
            }

            // Actualizar cuentas
            if (staging.CuentasFormaPago.Any())
            {
                var cuentasOriginales = proveedor.CuentasFormaPago.ToList();
                foreach (var cuenta in cuentasOriginales)
                {
                    _proveedorRepository.RemoveCuenta(cuenta);
                }

                foreach (var cuentaStaging in staging.CuentasFormaPago)
                {
                    proveedor.CuentasFormaPago.Add(new ProveedorFormaPagoCuenta
                    {
                        IdProveedor = proveedor.IdProveedor,
                        IdFormaPago = cuentaStaging.IdFormaPago,
                        IdBanco = cuentaStaging.IdBanco,
                        NumeroCuenta = cuentaStaging.NumeroCuenta,
                        Clabe = cuentaStaging.Clabe,
                        NumeroTarjeta = cuentaStaging.NumeroTarjeta,
                        Beneficiario = cuentaStaging.Beneficiario,
                        CorreoNotificacion = cuentaStaging.CorreoNotificacion,
                        Activo = cuentaStaging.Activo,
                        FechaCreacion = DateTime.UtcNow
                    });
                }
            }

            // Eliminar staging
            _dbContext.StagingProveedores.Remove(staging);
            await _dbContext.SaveChangesAsync();

            var result = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            _logger.LogInformation("Edición de proveedor {Id} autorizada por usuario {Usuario}", id, idUsuario);
            EnrichWideEvent(action: "AutorizarEdicion", entityId: id, nombre: result?.RazonSocial);
            return result!.ToResponse();
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "AutorizarEdicion", entityId: id, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("autorizar la edición del proveedor");
        }
    }

    public async Task<ErrorOr<ProveedorResponse>> RechazarEdicionAsync(int id, int idUsuario)
    {
        try
        {
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "RechazarEdicion", entityId: id, notFound: true);
                return CommonErrors.NotFound("proveedor", id.ToString());
            }

            if (proveedor.Estatus != EstatusProveedor.EditadoPendiente)
            {
                return Error.Conflict("El proveedor no tiene ediciones pendientes por rechazar");
            }

            var staging = await _dbContext.StagingProveedores
                .FirstOrDefaultAsync(s => s.IdProveedor == id);

            if (staging == null)
            {
                return Error.Conflict("No se encontró el staging para este proveedor");
            }

            // Restaurar estatus original (aprobado) y desvincular staging
            proveedor.Estatus = EstatusProveedor.Aprobado;
            proveedor.FechaModificacion = DateTime.UtcNow;

            // Eliminar staging
            _dbContext.StagingProveedores.Remove(staging);
            await _dbContext.SaveChangesAsync();

            var result = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            _logger.LogInformation("Edición de proveedor {Id} rechazada por usuario {Usuario}", id, idUsuario);
            EnrichWideEvent(action: "RechazarEdicion", entityId: id, nombre: result?.RazonSocial);
            return result!.ToResponse();
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "RechazarEdicion", entityId: id, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("rechazar la edición del proveedor");
        }
    }

    public async Task<ErrorOr<StagingProveedorResponse>> GetStagingByProveedorIdAsync(int idProveedor)
    {
        try
        {
            var staging = await _dbContext.StagingProveedores
                .Include(s => s.Detalle)
                .Include(s => s.CuentasFormaPago)
                    .ThenInclude(c => c.FormaPago)
                .Include(s => s.CuentasFormaPago)
                    .ThenInclude(c => c.Banco)
                .Include(s => s.RegimenFiscal)
                .FirstOrDefaultAsync(s => s.IdProveedor == idProveedor);

            if (staging == null)
            {
                return CommonErrors.NotFound("staging de proveedor", idProveedor.ToString());
            }

            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(idProveedor);
            if (proveedor == null)
            {
                return CommonErrors.NotFound("proveedor", idProveedor.ToString());
            }

            var diffs = GenerarDiff(proveedor, staging);

            return new StagingProveedorResponse
            {
                IdStaging = staging.IdStaging,
                IdProveedor = staging.IdProveedor,
                RazonSocial = staging.RazonSocial,
                RazonSocialNormalizada = staging.RazonSocialNormalizada,
                RFC = staging.RFC,
                CodigoPostal = staging.CodigoPostal,
                RegimenFiscalId = staging.RegimenFiscalId,
                RegimenFiscalNombre = staging.RegimenFiscal?.Descripcion,
                UsoCfdi = staging.UsoCfdi,
                SinDatosFiscales = staging.SinDatosFiscales,
                FechaStaging = staging.FechaStaging,
                EditadoPor = staging.EditadoPor,
                Detalle = staging.Detalle != null ? new StagingProveedorDetalleResponse
                {
                    IdStagingDetalle = staging.Detalle.IdStagingDetalle,
                    PersonaContactoNombre = staging.Detalle.PersonaContactoNombre,
                    ContactoTelefono = staging.Detalle.ContactoTelefono,
                    ContactoEmail = staging.Detalle.ContactoEmail,
                    Comentario = staging.Detalle.Comentario,
                    CaratulaPath = staging.Detalle.CaratulaPath
                } : null,
                CuentasFormaPago = staging.CuentasFormaPago.Select(c => new StagingProveedorFormaPagoCuentaResponse
                {
                    IdStagingCuenta = c.IdStagingCuenta,
                    IdFormaPago = c.IdFormaPago,
                    FormaPagoNombre = c.FormaPago?.Nombre,
                    IdBanco = c.IdBanco,
                    BancoNombre = c.Banco?.Nombre,
                    NumeroCuenta = c.NumeroCuenta,
                    Clabe = c.Clabe,
                    NumeroTarjeta = c.NumeroTarjeta,
                    Beneficiario = c.Beneficiario,
                    CorreoNotificacion = c.CorreoNotificacion,
                    Activo = c.Activo
                }).ToList(),
                Diferencias = diffs
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetStagingByProveedorId", entityId: idProveedor, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("obtener el staging del proveedor");
        }
    }

    private List<CampoDiff> GenerarDiff(Proveedor original, StagingProveedor staging)
    {
        var diffs = new List<CampoDiff>();

        if (original.RazonSocial != staging.RazonSocial)
            diffs.Add(new CampoDiff { Campo = "RazonSocial", Label = "Razón Social", ValorAnterior = original.RazonSocial, ValorNuevo = staging.RazonSocial });

        if (original.RFC != staging.RFC)
            diffs.Add(new CampoDiff { Campo = "RFC", Label = "RFC", ValorAnterior = original.RFC, ValorNuevo = staging.RFC });

        if (original.CodigoPostal != staging.CodigoPostal)
            diffs.Add(new CampoDiff { Campo = "CodigoPostal", Label = "Código Postal", ValorAnterior = original.CodigoPostal, ValorNuevo = staging.CodigoPostal });

        if (original.RegimenFiscalId != staging.RegimenFiscalId)
            diffs.Add(new CampoDiff { Campo = "RegimenFiscalId", Label = "Régimen Fiscal", ValorAnterior = original.RegimenFiscal?.Descripcion, ValorNuevo = staging.RegimenFiscal?.Descripcion });

        if (original.UsoCfdi != staging.UsoCfdi)
            diffs.Add(new CampoDiff { Campo = "UsoCfdi", Label = "Uso CFDI", ValorAnterior = original.UsoCfdi, ValorNuevo = staging.UsoCfdi });

        if (original.SinDatosFiscales != staging.SinDatosFiscales)
            diffs.Add(new CampoDiff { Campo = "SinDatosFiscales", Label = "Sin Datos Fiscales", ValorAnterior = original.SinDatosFiscales.ToString(), ValorNuevo = staging.SinDatosFiscales.ToString() });

        if (original.Detalle != null && staging.Detalle != null)
        {
            if (original.Detalle.PersonaContactoNombre != staging.Detalle.PersonaContactoNombre)
                diffs.Add(new CampoDiff { Campo = "PersonaContactoNombre", Label = "Contacto", ValorAnterior = original.Detalle.PersonaContactoNombre, ValorNuevo = staging.Detalle.PersonaContactoNombre });

            if (original.Detalle.ContactoTelefono != staging.Detalle.ContactoTelefono)
                diffs.Add(new CampoDiff { Campo = "ContactoTelefono", Label = "Teléfono", ValorAnterior = original.Detalle.ContactoTelefono, ValorNuevo = staging.Detalle.ContactoTelefono });

            if (original.Detalle.ContactoEmail != staging.Detalle.ContactoEmail)
                diffs.Add(new CampoDiff { Campo = "ContactoEmail", Label = "Email", ValorAnterior = original.Detalle.ContactoEmail, ValorNuevo = staging.Detalle.ContactoEmail });

            if (original.Detalle.Comentario != staging.Detalle.Comentario)
                diffs.Add(new CampoDiff { Campo = "Comentario", Label = "Comentario", ValorAnterior = original.Detalle.Comentario, ValorNuevo = staging.Detalle.Comentario });
        }

        return diffs;
    }
}
