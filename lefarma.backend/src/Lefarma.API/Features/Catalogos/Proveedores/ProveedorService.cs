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
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Lefarma.UnitTests")]
[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Lefarma.IntegrationTests")]

namespace Lefarma.API.Features.Catalogos.Proveedores;

    public partial class ProveedorService : BaseService, IProveedorService
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

            // Enriquecer cuentas con información de órdenes asociadas
            foreach (var proveedor in response)
            {
                if (proveedor.CuentasFormaPago != null)
                {
                    foreach (var cuenta in proveedor.CuentasFormaPago)
                    {
                        cuenta.TieneOrdenes = await CuentaTieneOrdenesAsociadasAsync(cuenta.IdCuen);
                    }
                }
            }

            EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
            {
                ["filters"] = new { query.RazonSocial, query.RFC, query.OrderBy, query.OrderDirection }
            });
            return response;
        }
        catch (Exception ex)
        {
            //EnrichWideEvent(action: "GetAll", error: ex.GetDetailedMessage());
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
            
            // Enriquecer cuentas con información de órdenes asociadas
            if (response.CuentasFormaPago != null)
            {
                foreach (var cuenta in response.CuentasFormaPago)
                {
                    cuenta.TieneOrdenes = await CuentaTieneOrdenesAsociadasAsync(cuenta.IdCuen);
                }
            }
            
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
                    return CommonErrors.NotFound("RegimenFiscal", request.RegimenFiscalId.Value.ToString());
                }
            }

            var newProveedor = new Proveedor
            {
                RazonSocial = request.RazonSocial,
                RazonSocialNormalizada = StringExtensions.RemoveDiacritics(request.RazonSocial),
                RFC = string.IsNullOrWhiteSpace(request.RFC) ? null : request.RFC.Trim(),
                CodigoPostal = string.IsNullOrWhiteSpace(request.CodigoPostal) ? null : request.CodigoPostal.Trim(),
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
                        NumeroCuenta = cuenta.NumeroCuenta?.Replace(" ", ""),
                        Clabe = cuenta.Clabe?.Replace(" ", ""),
                        NumeroTarjeta = cuenta.NumeroTarjeta,
                        Beneficiario = cuenta.Beneficiario,
                        CorreoNotificacion = cuenta.CorreoNotificacion,
                        Activo = cuenta.Activo,
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
                    return CommonErrors.NotFound("RegimenFiscal", request.RegimenFiscalId.Value.ToString());
                }
            }

            // Actualización directa para Nuevo, Rechazado
            // EditadoPendiente va a staging (el flujo correcto para proveedores aprobados)
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
                proveedor.Detalle.Comentario = request.Detalle.Comentario;
                if (request.Detalle.CaratulaUrl != null)
                    proveedor.Detalle.CaratulaPath = request.Detalle.CaratulaUrl;
                proveedor.Detalle.FechaModificacion = DateTime.UtcNow;
            }

            if (request.CuentasFormaPago != null)
            {
                var cuentasExistentes = proveedor.CuentasFormaPago.ToList();
                var cuentasRequest = request.CuentasFormaPago;
                
                // Identificar cuentas que se deben eliminar (están en BD pero no en request)
                var idsEnRequest = cuentasRequest
                    .Where(c => c.IdCuen > 0)
                    .Select(c => c.IdCuen)
                    .ToHashSet();
                
                foreach (var cuentaExistente in cuentasExistentes)
                {
                    if (!idsEnRequest.Contains(cuentaExistente.IdCuen))
                    {
                        // La cuenta se quiere eliminar
                        var tieneOrdenes = await CuentaTieneOrdenesAsociadasAsync(cuentaExistente.IdCuen);
                        if (tieneOrdenes)
                        {
                            // Soft delete: marcar como inactivo
                            cuentaExistente.Activo = false;
                            cuentaExistente.FechaModificacion = DateTime.UtcNow;
                        }
                        else
                        {
                            // Hard delete: eliminar físicamente
                            _proveedorRepository.RemoveCuenta(cuentaExistente);
                        }
                    }
                }

                // Procesar cuentas del request
                foreach (var cuentaRequest in cuentasRequest)
                {
                    if (cuentaRequest.IdCuen > 0)
                    {
                        // Actualizar cuenta existente
                        var cuentaExistente = cuentasExistentes.FirstOrDefault(c => c.IdCuen == cuentaRequest.IdCuen);
                        if (cuentaExistente != null)
                        {
                            cuentaExistente.IdFormaPago = cuentaRequest.IdFormaPago;
                            cuentaExistente.IdBanco = cuentaRequest.IdBanco;
                            cuentaExistente.NumeroCuenta = cuentaRequest.NumeroCuenta?.Replace(" ", "");
                            cuentaExistente.Clabe = cuentaRequest.Clabe?.Replace(" ", "");
                            cuentaExistente.NumeroTarjeta = cuentaRequest.NumeroTarjeta;
                            cuentaExistente.Beneficiario = cuentaRequest.Beneficiario;
                            cuentaExistente.CorreoNotificacion = cuentaRequest.CorreoNotificacion;
                            cuentaExistente.Activo = cuentaRequest.Activo;
                            cuentaExistente.FechaModificacion = DateTime.UtcNow;
                        }
                    }
                    else
                    {
                        // Crear nueva cuenta
                        var nuevaCuenta = new ProveedorFormaPagoCuenta
                        {
                            IdProveedor = proveedor.IdProveedor,
                            IdFormaPago = cuentaRequest.IdFormaPago,
                            IdBanco = cuentaRequest.IdBanco,
                            NumeroCuenta = cuentaRequest.NumeroCuenta?.Replace(" ", ""),
                            Clabe = cuentaRequest.Clabe?.Replace(" ", ""),
                            NumeroTarjeta = cuentaRequest.NumeroTarjeta,
                            Beneficiario = cuentaRequest.Beneficiario,
                            CorreoNotificacion = cuentaRequest.CorreoNotificacion,
                            Activo = cuentaRequest.Activo,
                            FechaCreacion = DateTime.UtcNow
                        };
                        proveedor.CuentasFormaPago.Add(nuevaCuenta);
                    }
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
        try
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
                    RazonSocial = request.RazonSocial,
                    RazonSocialNormalizada = StringExtensions.RemoveDiacritics(request.RazonSocial),
                    RFC = request.RFC,
                    CodigoPostal = request.CodigoPostal,
                    RegimenFiscalId = request.RegimenFiscalId,
                    UsoCfdi = request.UsoCfdi,
                    SinDatosFiscales = request.SinDatosFiscales,
                    FechaStaging = DateTime.UtcNow,
                    Estatus = EstatusProveedor.EditadoPendiente
                };
                _dbContext.StagingProveedores.Add(staging);
            }

            // Copiar datos del request al staging (para staging existente)
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
                        IdDetalle = proveedor.Detalle?.IdDetalle ?? 0,
                        FechaCreacion = DateTime.UtcNow
                    };
                    _dbContext.StagingProveedoresDetalle.Add(detalleStaging);
                }

                detalleStaging.PersonaContactoNombre = request.Detalle.PersonaContactoNombre;
                detalleStaging.ContactoTelefono = request.Detalle.ContactoTelefono;
                detalleStaging.ContactoEmail = request.Detalle.ContactoEmail;
                detalleStaging.Comentario = request.Detalle.Comentario;
                // La carátula NO va a staging: se sube aparte vía UpdateCaratulaAsync
                // para que esté disponible inmediatamente sin esperar autorización.
                detalleStaging.FechaModificacion = DateTime.UtcNow;
            }

            // Cuentas
            if (request.CuentasFormaPago != null)
            {
                var cuentasExistentes = staging.CuentasFormaPago.ToList();
                _dbContext.StagingProveedoresFormasPagoCuentas.RemoveRange(cuentasExistentes);
                staging.CuentasFormaPago.Clear();

                foreach (var cuenta in request.CuentasFormaPago)
                {
                    var stagingCuenta = new StagingProveedorFormaPagoCuenta
                    {
                        IdCuen = cuenta.IdCuen > 0 ? cuenta.IdCuen : null,
                        IdFormaPago = cuenta.IdFormaPago,
                        IdBanco = cuenta.IdBanco,
                        NumeroCuenta = cuenta.NumeroCuenta?.Replace(" ", ""),
                        Clabe = cuenta.Clabe?.Replace(" ", ""),
                        NumeroTarjeta = cuenta.NumeroTarjeta,
                        Beneficiario = cuenta.Beneficiario,
                        CorreoNotificacion = cuenta.CorreoNotificacion,
                        Activo = cuenta.Activo,
                        CaratulaPath = cuenta.CaratulaUrl
                    };

                    stagingCuenta.StagingProveedor = staging;
                    staging.CuentasFormaPago.Add(stagingCuenta);
                }
            }

            // Vincular proveedor original al staging y cambiar estatus a EditadoPendiente
            proveedor.Estatus = EstatusProveedor.EditadoPendiente;
            proveedor.FechaModificacion = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            var result = await _proveedorRepository.GetByIdWithDetailsAsync(id);
            EnrichWideEvent(action: "Update → Staging", entityId: id, nombre: result?.RazonSocial);
            return result!.ToResponse();
        }catch (Exception ex)
        {
            Console.WriteLine(ex.ToString());
            return CommonErrors.InternalServerError("Error inesperado al guardar los cambios en staging para el proveedor.");

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
            return CommonErrors.HasDependencies("Proveedor");
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
                return CommonErrors.Conflict("Proveedor", "El proveedor ya está aprobado");

            if (proveedor.Estatus == EstatusProveedor.Rechazado)
                return CommonErrors.Conflict("Proveedor", "El proveedor está rechazado y no se puede aprobar");

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
                return CommonErrors.Conflict("Proveedor", "El proveedor ya está rechazado");

            if (proveedor.Estatus == EstatusProveedor.Aprobado)
                return CommonErrors.Conflict("Proveedor", "El proveedor está aprobado y no se puede rechazar");

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
                return CommonErrors.Validation("CaratulaPath", "La ruta de la caratula contiene caracteres invalidos");
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
                return CommonErrors.Conflict("Proveedor", "El proveedor no tiene detalle");
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
                return CommonErrors.Conflict("Proveedor", "No existe caratula para eliminar");
            }

            var basePath = _configuration["ArchivosSettings:BasePath"]
                ?? "wwwroot/media/archivos";
            var fullPath = Path.GetFullPath(Path.Combine(basePath, proveedor.Detalle.CaratulaPath));

            // Validate that the resolved fullPath is within the basePath to prevent path traversal
            var resolvedBasePath = Path.GetFullPath(basePath);
            if (!fullPath.StartsWith(resolvedBasePath))
            {
                EnrichWideEvent(action: "DeleteCaratula", entityId: id, error: "Ruta de caratula invalida");
                return CommonErrors.Validation("CaratulaPath", "La ruta de la caratula esta fuera del directorio permitido");
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

    /// <summary>
    /// Sube (o reemplaza) la carátula de UNA cuenta bancaria específica, enrutando por estatus:
    /// prospecto (Nuevo/Rechazado) → escritura directa; autorizado (Aprobado/EditadoPendiente) → staging.
    /// El archivo YA fue persistido en disco por el controller; aquí recibimos la ruta relativa.
    /// </summary>
    public async Task<ErrorOr<bool>> SubirCaratulaCuentaAsync(int proveedorId, int cuentaId, string caratulaPath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(caratulaPath) || caratulaPath.Contains("..") || caratulaPath.Contains("\\"))
            {
                EnrichWideEvent(action: "SubirCaratulaCuenta", entityId: proveedorId, error: "Ruta de caratula invalida");
                return CommonErrors.Validation("CaratulaPath", "La ruta de la caratula contiene caracteres invalidos");
            }

            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(proveedorId);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "SubirCaratulaCuenta", entityId: proveedorId, notFound: true);
                return CommonErrors.NotFound("proveedor", proveedorId.ToString());
            }

            var cuenta = proveedor.CuentasFormaPago.FirstOrDefault(c => c.IdCuen == cuentaId);
            if (cuenta is null)
            {
                EnrichWideEvent(action: "SubirCaratulaCuenta", entityId: proveedorId, error: "Cuenta no encontrada");
                return CommonErrors.NotFound("cuenta", cuentaId.ToString());
            }

            return DeterminarRutaCaratula(proveedor.Estatus) switch
            {
                RutaCaratula.Directo => await EscribirCaratulaDirectoAsync(proveedor, cuenta, caratulaPath),
                RutaCaratula.Staging => await StagearCaratulaAsync(proveedor, cuenta, caratulaPath),
                _ => Error.Conflict($"Estatus de proveedor no soportado para caratula: {EstatusProveedor.GetDescripcion(proveedor.Estatus)}"),
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "SubirCaratulaCuenta", entityId: proveedorId, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("subir la caratula de la cuenta");
        }
    }

    /// <summary>
    /// Devuelve las carátulas que tiene un proveedor (una por cuenta con caratula_path no vacío),
    /// para alimentar el modal "Ver carátulas" del listado.
    /// </summary>
    public async Task<ErrorOr<List<CaratulaCuentaResponse>>> GetCaratulasByProveedorAsync(int proveedorId)
    {
        try
        {
            var proveedor = await _proveedorRepository.GetByIdWithDetailsAsync(proveedorId);
            if (proveedor == null)
            {
                EnrichWideEvent(action: "GetCaratulas", entityId: proveedorId, notFound: true);
                return CommonErrors.NotFound("proveedor", proveedorId.ToString());
            }

            var caratulas = proveedor.CuentasFormaPago
                .Where(c => !string.IsNullOrWhiteSpace(c.CaratulaPath))
                .Select(c => new CaratulaCuentaResponse
                {
                    CuentaId = c.IdCuen,
                    Ultimos4 = Ultimos4(c.Clabe, c.NumeroCuenta),
                    CaratulaUrl = c.CaratulaPath
                })
                .ToList();

            return caratulas;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetCaratulas", entityId: proveedorId, error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("obtener las caratulas del proveedor");
        }
    }

    /// <summary>
    /// Tabla de decisión estatus → ruta de carátula (binding rule #2/#6).
    /// Extraída a método puro para test exhaustivo (incluye el guard de exhaustividad runtime).
    /// </summary>
    internal enum RutaCaratula { Directo, Staging, Conflict }

    internal static RutaCaratula DeterminarRutaCaratula(int estatus) => estatus switch
    {
        EstatusProveedor.Nuevo => RutaCaratula.Directo,
        EstatusProveedor.Rechazado => RutaCaratula.Directo,
        EstatusProveedor.Aprobado => RutaCaratula.Staging,
        EstatusProveedor.EditadoPendiente => RutaCaratula.Staging,
        _ => RutaCaratula.Conflict,
    };

    /// <summary>
    /// Escritura directa de carátula para proveedores NO autorizados (Nuevo/Rechazado).
    /// Sin staging, sin diff, sin cambio de estatus (binding rule #6).
    /// </summary>
    private async Task<ErrorOr<bool>> EscribirCaratulaDirectoAsync(
        Proveedor proveedor, ProveedorFormaPagoCuenta cuenta, string caratulaPath)
    {
        cuenta.CaratulaPath = caratulaPath;
        cuenta.FechaModificacion = DateTime.UtcNow;
        await _proveedorRepository.UpdateAsync(proveedor);

        EnrichWideEvent(action: "SubirCaratulaCuenta", entityId: proveedor.IdProveedor, nombre: proveedor.RazonSocial);
        return true;
    }

    /// <summary>
    /// Sube la carátula a staging para proveedores AUTORIZADOS (Aprobado/EditadoPendiente).
    /// Si NO existe staging previo, clona TODO el estado live a staging para que GenerarDiff
    /// muestre ÚNICAMENTE el cambio de carátula (diff length == 1). Si existe staging previo
    /// (un edit pendiente), sólo actualiza la carátula de la cuenta objetivo en ese staging.
    /// La cuenta LIVE nunca se toca durante staging (reject = no-op por construcción).
    /// Preserva IdCuen en las cuentas stageadas (depende del fix de drift migration 025 paso 3).
    /// </summary>
    private async Task<ErrorOr<bool>> StagearCaratulaAsync(
        Proveedor proveedor, ProveedorFormaPagoCuenta cuenta, string caratulaPath)
    {
        var stagingExistente = await _dbContext.StagingProveedores
            .Include(s => s.Detalle)
            .Include(s => s.CuentasFormaPago)
            .FirstOrDefaultAsync(s => s.IdProveedor == proveedor.IdProveedor);

        if (stagingExistente != null)
        {
            // Ya hay un edit pendiente: actualizar la carátula de la cuenta objetivo en el staging existente.
            var stagedCuenta = stagingExistente.CuentasFormaPago.FirstOrDefault(c => c.IdCuen == cuenta.IdCuen);
            if (stagedCuenta != null)
            {
                stagedCuenta.CaratulaPath = caratulaPath;
            }
            else
            {
                stagingExistente.CuentasFormaPago.Add(new StagingProveedorFormaPagoCuenta
                {
                    IdCuen = cuenta.IdCuen,
                    IdFormaPago = cuenta.IdFormaPago,
                    IdBanco = cuenta.IdBanco,
                    NumeroCuenta = cuenta.NumeroCuenta,
                    Clabe = cuenta.Clabe,
                    NumeroTarjeta = cuenta.NumeroTarjeta,
                    Beneficiario = cuenta.Beneficiario,
                    CorreoNotificacion = cuenta.CorreoNotificacion,
                    Activo = cuenta.Activo,
                    CaratulaPath = caratulaPath,
                    StagingProveedor = stagingExistente
                });
            }
        }
        else
        {
            // Sin staging previo: clonar TODO el estado live para que el diff sea sólo la carátula.
            var staging = new StagingProveedor
            {
                IdProveedor = proveedor.IdProveedor,
                RazonSocial = proveedor.RazonSocial,
                RazonSocialNormalizada = proveedor.RazonSocialNormalizada,
                RFC = proveedor.RFC,
                CodigoPostal = proveedor.CodigoPostal,
                RegimenFiscalId = proveedor.RegimenFiscalId,
                UsoCfdi = proveedor.UsoCfdi,
                SinDatosFiscales = proveedor.SinDatosFiscales,
                Estatus = EstatusProveedor.EditadoPendiente,
                CambioEstatusPor = proveedor.CambioEstatusPor,
                FechaRegistro = proveedor.FechaRegistro,
                FechaStaging = DateTime.UtcNow
            };

            if (proveedor.Detalle != null)
            {
                staging.Detalle = new StagingProveedorDetalle
                {
                    IdDetalle = proveedor.Detalle.IdDetalle,
                    PersonaContactoNombre = proveedor.Detalle.PersonaContactoNombre,
                    ContactoTelefono = proveedor.Detalle.ContactoTelefono,
                    ContactoEmail = proveedor.Detalle.ContactoEmail,
                    Comentario = proveedor.Detalle.Comentario,
                    CaratulaPath = proveedor.Detalle.CaratulaPath,
                    FechaCreacion = proveedor.Detalle.FechaCreacion
                };
            }

            foreach (var c in proveedor.CuentasFormaPago)
            {
                staging.CuentasFormaPago.Add(new StagingProveedorFormaPagoCuenta
                {
                    IdCuen = c.IdCuen,
                    IdFormaPago = c.IdFormaPago,
                    IdBanco = c.IdBanco,
                    NumeroCuenta = c.NumeroCuenta,
                    Clabe = c.Clabe,
                    NumeroTarjeta = c.NumeroTarjeta,
                    Beneficiario = c.Beneficiario,
                    CorreoNotificacion = c.CorreoNotificacion,
                    Activo = c.Activo,
                    // La cuenta objetivo recibe la nueva carátula; las demás se clonan idénticas (diff == 0).
                    CaratulaPath = c.IdCuen == cuenta.IdCuen ? caratulaPath : c.CaratulaPath,
                    StagingProveedor = staging
                });
            }

            _dbContext.StagingProveedores.Add(staging);
        }

        proveedor.Estatus = EstatusProveedor.EditadoPendiente;
        proveedor.FechaModificacion = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        EnrichWideEvent(action: "StagearCaratula", entityId: proveedor.IdProveedor, nombre: proveedor.RazonSocial);
        return true;
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

            // Actualizar cuentas desde staging
            if (staging.CuentasFormaPago.Any())
            {
                var cuentasOriginales = proveedor.CuentasFormaPago.ToList();
                var cuentasStaging = staging.CuentasFormaPago.ToList();
                
                // Identificar cuentas que se deben eliminar (están en BD pero no en staging)
                var idsEnStaging = cuentasStaging
                    .Where(c => c.IdCuen > 0)
                    .Select(c => c.IdCuen)
                    .ToHashSet();
                
                foreach (var cuentaOriginal in cuentasOriginales)
                {
                    if (!idsEnStaging.Contains(cuentaOriginal.IdCuen))
                    {
                        // La cuenta se quiere eliminar
                        var tieneOrdenes = await CuentaTieneOrdenesAsociadasAsync(cuentaOriginal.IdCuen);
                        if (tieneOrdenes)
                        {
                            // Soft delete: marcar como inactivo
                            cuentaOriginal.Activo = false;
                            cuentaOriginal.FechaModificacion = DateTime.UtcNow;
                        }
                        else
                        {
                            // Hard delete: eliminar físicamente
                            _proveedorRepository.RemoveCuenta(cuentaOriginal);
                        }
                    }
                }

                // Procesar cuentas del staging
                foreach (var cuentaStaging in cuentasStaging)
                {
                    if (cuentaStaging.IdCuen > 0)
                    {
                        // Cuenta existente: buscarla
                        var cuentaOriginal = cuentasOriginales.FirstOrDefault(c => c.IdCuen == cuentaStaging.IdCuen);
                        if (cuentaOriginal != null)
                        {
                            var tieneOrdenes = await CuentaTieneOrdenesAsociadasAsync(cuentaOriginal.IdCuen);
                            if (tieneOrdenes)
                            {
                                // Si tiene órdenes, crear nueva versión y desactivar la vieja
                                cuentaOriginal.Activo = false;
                                cuentaOriginal.FechaModificacion = DateTime.UtcNow;
                                
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
                                    CaratulaPath = cuentaStaging.CaratulaPath,
                                    FechaCreacion = DateTime.UtcNow
                                });
                            }
                            else
                            {
                                // Sin órdenes: actualizar in-place
                                cuentaOriginal.IdFormaPago = cuentaStaging.IdFormaPago;
                                cuentaOriginal.IdBanco = cuentaStaging.IdBanco;
                                cuentaOriginal.NumeroCuenta = cuentaStaging.NumeroCuenta;
                                cuentaOriginal.Clabe = cuentaStaging.Clabe;
                                cuentaOriginal.NumeroTarjeta = cuentaStaging.NumeroTarjeta;
                                cuentaOriginal.Beneficiario = cuentaStaging.Beneficiario;
                                cuentaOriginal.CorreoNotificacion = cuentaStaging.CorreoNotificacion;
                                cuentaOriginal.Activo = cuentaStaging.Activo;
                                cuentaOriginal.CaratulaPath = cuentaStaging.CaratulaPath;
                                cuentaOriginal.FechaModificacion = DateTime.UtcNow;
                            }
                        }
                    }
                    else
                    {
                        // Nueva cuenta desde staging.
                        // Defensive dedupe: si el staging no preservó IdCuen (frontend sin
                        // idCuen, datos históricos, etc.), la cuenta "nueva" podría ya
                        // existir en el proveedor. Validar por CLABE (clave única bancaria)
                        // o por banco + número de cuenta antes de insertar.
                        var clabeStaging = (cuentaStaging.Clabe ?? string.Empty).Trim();
                        var numeroCuentaStaging = (cuentaStaging.NumeroCuenta ?? string.Empty).Trim();

                        var cuentaExistente = proveedor.CuentasFormaPago.FirstOrDefault(c =>
                            (!string.IsNullOrEmpty(clabeStaging) &&
                             (c.Clabe ?? string.Empty).Trim() == clabeStaging)
                            ||
                            (c.IdBanco == cuentaStaging.IdBanco &&
                             !string.IsNullOrEmpty(numeroCuentaStaging) &&
                             (c.NumeroCuenta ?? string.Empty).Trim() == numeroCuentaStaging));

                        if (cuentaExistente != null)
                        {
                            // Ya existe una cuenta equivalente: actualizar in-place en vez de duplicar.
                            cuentaExistente.IdFormaPago = cuentaStaging.IdFormaPago;
                            cuentaExistente.IdBanco = cuentaStaging.IdBanco;
                            cuentaExistente.NumeroCuenta = cuentaStaging.NumeroCuenta;
                            cuentaExistente.Clabe = cuentaStaging.Clabe;
                            cuentaExistente.NumeroTarjeta = cuentaStaging.NumeroTarjeta;
                            cuentaExistente.Beneficiario = cuentaStaging.Beneficiario;
                            cuentaExistente.CorreoNotificacion = cuentaStaging.CorreoNotificacion;
                            cuentaExistente.Activo = cuentaStaging.Activo;
                            cuentaExistente.CaratulaPath = cuentaStaging.CaratulaPath;
                            cuentaExistente.FechaModificacion = DateTime.UtcNow;
                        }
                        else
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
                                CaratulaPath = cuentaStaging.CaratulaPath,
                                FechaCreacion = DateTime.UtcNow
                            });
                        }
                    }
                }
            }

            // Eliminar staging`
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
                    IdCuen = c.IdCuen,
                    IdFormaPago = c.IdFormaPago,
                    FormaPagoNombre = c.FormaPago?.Nombre,
                    IdBanco = c.IdBanco,
                    BancoNombre = c.Banco?.Nombre,
                    NumeroCuenta = c.NumeroCuenta,
                    Clabe = c.Clabe,
                    NumeroTarjeta = c.NumeroTarjeta,
                    Beneficiario = c.Beneficiario,
                    CorreoNotificacion = c.CorreoNotificacion,
                    Activo = c.Activo,
                    CaratulaUrl = c.CaratulaPath
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

    internal static List<CampoDiff> GenerarDiff(Proveedor original, StagingProveedor staging)
    {
        var diffs = new List<CampoDiff>();

        if (StringsDifieren(original.RazonSocial, staging.RazonSocial))
            diffs.Add(new CampoDiff { Campo = "RazonSocial", Label = "Razón Social", ValorAnterior = original.RazonSocial, ValorNuevo = staging.RazonSocial });

        if (StringsDifieren(original.RFC, staging.RFC))
            diffs.Add(new CampoDiff { Campo = "RFC", Label = "RFC", ValorAnterior = original.RFC, ValorNuevo = staging.RFC });

        if (StringsDifieren(original.CodigoPostal, staging.CodigoPostal))
            diffs.Add(new CampoDiff { Campo = "CodigoPostal", Label = "Código Postal", ValorAnterior = original.CodigoPostal, ValorNuevo = staging.CodigoPostal });

        if (original.RegimenFiscalId != staging.RegimenFiscalId)
            diffs.Add(new CampoDiff { Campo = "RegimenFiscalId", Label = "Régimen Fiscal", ValorAnterior = original.RegimenFiscal?.Descripcion, ValorNuevo = staging.RegimenFiscal?.Descripcion });

        if (StringsDifieren(original.UsoCfdi, staging.UsoCfdi))
            diffs.Add(new CampoDiff { Campo = "UsoCfdi", Label = "Uso CFDI", ValorAnterior = original.UsoCfdi, ValorNuevo = staging.UsoCfdi });

        if (original.SinDatosFiscales != staging.SinDatosFiscales)
            diffs.Add(new CampoDiff { Campo = "SinDatosFiscales", Label = "Sin Datos Fiscales", ValorAnterior = original.SinDatosFiscales.ToString(), ValorNuevo = staging.SinDatosFiscales.ToString() });

        if (original.Detalle != null && staging.Detalle != null)
        {
            if (StringsDifieren(original.Detalle.PersonaContactoNombre, staging.Detalle.PersonaContactoNombre))
                diffs.Add(new CampoDiff { Campo = "PersonaContactoNombre", Label = "Contacto", ValorAnterior = original.Detalle.PersonaContactoNombre, ValorNuevo = staging.Detalle.PersonaContactoNombre });

            if (StringsDifieren(original.Detalle.ContactoTelefono, staging.Detalle.ContactoTelefono))
                diffs.Add(new CampoDiff { Campo = "ContactoTelefono", Label = "Teléfono", ValorAnterior = original.Detalle.ContactoTelefono, ValorNuevo = staging.Detalle.ContactoTelefono });

            if (StringsDifieren(original.Detalle.ContactoEmail, staging.Detalle.ContactoEmail))
                diffs.Add(new CampoDiff { Campo = "ContactoEmail", Label = "Email", ValorAnterior = original.Detalle.ContactoEmail, ValorNuevo = staging.Detalle.ContactoEmail });

            if (StringsDifieren(original.Detalle.Comentario, staging.Detalle.Comentario))
                diffs.Add(new CampoDiff { Campo = "Comentario", Label = "Comentario", ValorAnterior = original.Detalle.Comentario, ValorNuevo = staging.Detalle.Comentario });
        }

        var originalCuentas = original.CuentasFormaPago.ToList();
        var stagingCuentas = staging.CuentasFormaPago.ToList();

        var originalConId = originalCuentas.Where(c => c.IdCuen > 0).ToDictionary(c => c.IdCuen);
        var stagingConId = stagingCuentas
            .Where(c => c.IdCuen.HasValue && c.IdCuen.Value > 0)
            .ToDictionary(c => c.IdCuen!.Value);

        foreach (var id in originalConId.Keys.Except(stagingConId.Keys).OrderBy(id => id))
        {
            var cuenta = originalConId[id];
            var valor = !string.IsNullOrWhiteSpace(cuenta.Clabe) ? cuenta.Clabe : cuenta.NumeroCuenta;
            diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].Eliminada", Label = "Cuenta eliminada", ValorAnterior = valor, ValorNuevo = null });
        }

        foreach (var id in stagingConId.Keys.Except(originalConId.Keys).OrderBy(id => id))
        {
            var cuenta = stagingConId[id];
            var valor = !string.IsNullOrWhiteSpace(cuenta.Clabe) ? cuenta.Clabe : cuenta.NumeroCuenta;
            diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].Nueva", Label = "Nueva cuenta", ValorAnterior = null, ValorNuevo = valor });
        }

        // Cuentas NUEVAS (sin IdCuen en staging) que traen carátula: emiten "… agregada".
        foreach (var cuenta in stagingCuentas.Where(c => !c.IdCuen.HasValue || c.IdCuen.Value <= 0)
                                             .Where(c => !string.IsNullOrWhiteSpace(c.CaratulaPath))
                                             .OrderBy(c => c.NumeroCuenta ?? c.Clabe ?? ""))
        {
            var last4 = Ultimos4(cuenta.Clabe, cuenta.NumeroCuenta);
            diffs.Add(new CampoDiff
            {
                Campo = "CuentasFormaPago[].Caratula",
                Label = $"Carátula cuenta ••{last4} agregada",
                ValorAnterior = null,
                ValorNuevo = cuenta.CaratulaPath
            });
        }

        foreach (var id in originalConId.Keys.Intersect(stagingConId.Keys).OrderBy(id => id))
        {
            var orig = originalConId[id];
            var stag = stagingConId[id];

            if (orig.IdFormaPago != stag.IdFormaPago)
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].IdFormaPago", Label = "Forma de pago", ValorAnterior = orig.FormaPago?.Nombre, ValorNuevo = stag.FormaPago?.Nombre });
            if (orig.IdBanco != stag.IdBanco)
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].IdBanco", Label = "Banco", ValorAnterior = orig.Banco?.Nombre, ValorNuevo = stag.Banco?.Nombre });
            if (StringsDifieren(orig.NumeroCuenta, stag.NumeroCuenta))
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].NumeroCuenta", Label = "Número de cuenta", ValorAnterior = orig.NumeroCuenta, ValorNuevo = stag.NumeroCuenta });
            if (StringsDifieren(orig.Clabe, stag.Clabe))
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].Clabe", Label = "CLABE", ValorAnterior = orig.Clabe, ValorNuevo = stag.Clabe });
            if (StringsDifieren(orig.NumeroTarjeta, stag.NumeroTarjeta))
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].NumeroTarjeta", Label = "Tarjeta", ValorAnterior = orig.NumeroTarjeta, ValorNuevo = stag.NumeroTarjeta });
            if (StringsDifieren(orig.Beneficiario, stag.Beneficiario))
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].Beneficiario", Label = "Beneficiario", ValorAnterior = orig.Beneficiario, ValorNuevo = stag.Beneficiario });
            if (StringsDifieren(orig.CorreoNotificacion, stag.CorreoNotificacion))
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].CorreoNotificacion", Label = "Correo notificación", ValorAnterior = orig.CorreoNotificacion, ValorNuevo = stag.CorreoNotificacion });
            if (orig.Activo != stag.Activo)
                diffs.Add(new CampoDiff { Campo = $"CuentasFormaPago[{id}].Activo", Label = "Activo", ValorAnterior = orig.Activo.ToString(), ValorNuevo = stag.Activo.ToString() });

            // Carátula: emite un CampoDiff propio cuando cambió. El label lleva los últimos 4 dígitos
            // de la cuenta y el verbo (agregada/eliminada/actualizada) según el sentido del cambio.
            if (StringsDifieren(orig.CaratulaPath, stag.CaratulaPath))
            {
                var last4 = Ultimos4(stag.Clabe ?? orig.Clabe, stag.NumeroCuenta ?? orig.NumeroCuenta);
                var accion = string.IsNullOrWhiteSpace(orig.CaratulaPath) ? "agregada"
                           : string.IsNullOrWhiteSpace(stag.CaratulaPath) ? "eliminada"
                           : "actualizada";
                diffs.Add(new CampoDiff
                {
                    Campo = $"CuentasFormaPago[{id}].Caratula",
                    Label = $"Carátula cuenta ••{last4} {accion}",
                    ValorAnterior = orig.CaratulaPath,
                    ValorNuevo = stag.CaratulaPath
                });
            }
        }

        return diffs;
    }

    /// <summary>
    /// Últimos 4 dígitos del identificador de cuenta (CLABE preferida, luego número de cuenta,
    /// luego "????"). Coincide con el criterio ya usado por GenerarDiff para el valor visible.
    /// </summary>
    internal static string Ultimos4(string? clabe, string? numeroCuenta)
    {
        var src = (!string.IsNullOrWhiteSpace(clabe) ? clabe : numeroCuenta) ?? "";
        if (src.Length == 0) return "????";
        return src.Length >= 4 ? src[^4..] : src;
    }

    private static bool StringsDifieren(string? a, string? b)
    {
        var na = string.IsNullOrWhiteSpace(a) ? null : a.Trim();
        var nb = string.IsNullOrWhiteSpace(b) ? null : b.Trim();
        return na != nb;
    }

    /// <summary>
    /// Verifica si una cuenta bancaria está siendo usada en órdenes de compra que están en flujo.
    /// Busca en la columna ids_cuentas_bancarias (JSON) de ordenes_compra y ordenes_compra_partidas.
    /// </summary>
    private async Task<bool> CuentaTieneOrdenesAsociadasAsync(int idCuenta)
    {
        var cuentaStr = idCuenta.ToString();
        var tieneEnCabecera = await _dbContext.OrdenesCompra
            //.Where(p => p.IdEstado != 7 || p.IdEstado != 8 || p.IdEstado != 9) //Cerrada, rechazada, cancelada
            .AnyAsync(o => o.IdsCuentasBancarias != null && o.IdsCuentasBancarias.Contains(cuentaStr));

        if (tieneEnCabecera) return true;

        var tieneEnPartidas = await _dbContext.OrdenesCompraPartidas
            .AnyAsync(p => p.IdsCuentasBancarias != null && p.IdsCuentasBancarias.Contains(cuentaStr)); 

        return tieneEnPartidas;
    }
}
