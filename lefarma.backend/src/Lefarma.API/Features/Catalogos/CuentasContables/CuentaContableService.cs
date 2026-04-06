using Azure;
using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.CuentasContables.DTOs;
using Lefarma.API.Features.Catalogos.CuentasContables.Extensions;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.CuentasContables
{
public class CuentaContableService : BaseService, ICuentaContableService
    {
        private readonly ICuentaContableRepository _cuentaContableRepository;
        private readonly ICentroCostoRepository _centroCostoRepository;
        private readonly ILogger<CuentaContableService> _logger;
        protected override string EntityName => "CuentaContable";

        public CuentaContableService(
            ICuentaContableRepository cuentaContableRepository,
            ICentroCostoRepository centroCostoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<CuentaContableService> logger)
            : base(wideEventAccessor)
        {
            _cuentaContableRepository = cuentaContableRepository;
            _centroCostoRepository = centroCostoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<CuentaContableResponse>>> GetAllAsync(CuentaContableRequest query)
        {
            try
            {
                var queryable = _cuentaContableRepository.GetQueryable();

                if (!string.IsNullOrWhiteSpace(query.Cuenta))
                    queryable = queryable.Where(c => c.Cuenta.Contains(query.Cuenta));

                if (!string.IsNullOrWhiteSpace(query.Nivel1))
                    queryable = queryable.Where(c => c.Nivel1 == query.Nivel1);

                if (!string.IsNullOrWhiteSpace(query.Nivel2))
                    queryable = queryable.Where(c => c.Nivel2 == query.Nivel2);

                if (query.CentroCostoId.HasValue)
                    queryable = queryable.Where(c => c.CentroCostoId == query.CentroCostoId.Value);

                if (query.Activo.HasValue)
                    queryable = queryable.Where(c => c.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("cuenta", "desc") => queryable.OrderByDescending(c => c.Cuenta),
                    ("descripcion", "asc") => queryable.OrderBy(c => c.Descripcion),
                    ("descripcion", "desc") => queryable.OrderByDescending(c => c.Descripcion),
                    ("nivel1", "asc") => queryable.OrderBy(c => c.Nivel1),
                    ("nivel1", "desc") => queryable.OrderByDescending(c => c.Nivel1),
                    _ => queryable.OrderBy(c => c.Cuenta)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Cuenta, query.Nivel1, query.Nivel2, query.CentroCostoId, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<CuentaContableResponse>();
                }

                var response = result.Select(c => c.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Cuenta, query.Nivel1, query.Nivel2, query.CentroCostoId, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(c => c.Cuenta + " - " + c.Descripcion).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError("obtener las cuentas contables");
            }
        }

        public async Task<ErrorOr<CuentaContableResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _cuentaContableRepository.GetByIdAsync(id);

                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("cuenta contable", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Cuenta + " - " + response.Descripcion);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"obtener la cuenta contable");
            }
        }

        public async Task<ErrorOr<CuentaContableResponse>> CreateAsync(CreateCuentaContableRequest request)
        {
            try
            {
                var existeCuenta = await _cuentaContableRepository.ExistsAsync(c => c.Cuenta == request.Cuenta);
                if (existeCuenta)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Cuenta, duplicate: true);
                    return CommonErrors.AlreadyExists("cuenta contable", "cuenta", request.Cuenta);
                }

                if (request.CentroCostoId.HasValue)
                {
                    var centroCostoExiste = await _centroCostoRepository.ExistsAsync(c => c.IdCentroCosto == request.CentroCostoId.Value);
                    if (!centroCostoExiste)
                    {
                        EnrichWideEvent(action: "Create", entityId: request.CentroCostoId.Value, notFound: true);
                        return CommonErrors.NotFound("centro de costo", request.CentroCostoId.Value.ToString());
                    }
                }

                var newCuentaContable = new CuentaContable
                {
                    Cuenta = request.Cuenta,
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Nivel1 = request.Nivel1,
                    Nivel2 = request.Nivel2,
                    EmpresaPrefijo = request.EmpresaPrefijo,
                    CentroCostoId = request.CentroCostoId,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _cuentaContableRepository.AddAsync(newCuentaContable);
                EnrichWideEvent(action: "Create", entityId: result.IdCuentaContable, nombre: result.Cuenta + " - " + result.Descripcion);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Cuenta, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"guardar la cuenta contable");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Cuenta, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al crear la cuenta contable.");
            }
        }

        public async Task<ErrorOr<CuentaContableResponse>> UpdateAsync(int id, UpdateCuentaContableRequest request)
        {
            try
            {
                var cuentaContable = await _cuentaContableRepository.GetByIdAsync(id);
                if (cuentaContable == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("cuenta contable", id.ToString());
                }

                var existeCuenta = await _cuentaContableRepository.ExistsAsync(c => c.Cuenta == request.Cuenta && c.IdCuentaContable != id);
                if (existeCuenta)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Cuenta, duplicate: true);
                    return CommonErrors.AlreadyExists("cuenta contable", "cuenta", request.Cuenta);
                }

                if (request.CentroCostoId.HasValue)
                {
                    var centroCostoExiste = await _centroCostoRepository.ExistsAsync(c => c.IdCentroCosto == request.CentroCostoId.Value);
                    if (!centroCostoExiste)
                    {
                        EnrichWideEvent(action: "Update", entityId: request.CentroCostoId.Value, notFound: true);
                        return CommonErrors.NotFound("centro de costo", request.CentroCostoId.Value.ToString());
                    }
                }

                cuentaContable.Cuenta = request.Cuenta;
                cuentaContable.Descripcion = request.Descripcion;
                cuentaContable.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                cuentaContable.Nivel1 = request.Nivel1;
                cuentaContable.Nivel2 = request.Nivel2;
                cuentaContable.EmpresaPrefijo = request.EmpresaPrefijo;
                cuentaContable.CentroCostoId = request.CentroCostoId;
                cuentaContable.Activo = request.Activo;
                cuentaContable.FechaModificacion = DateTime.UtcNow;

                var result = await _cuentaContableRepository.UpdateAsync(cuentaContable);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Cuenta + " - " + result.Descripcion);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.ConcurrencyError("cuenta contable");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"actualizar la cuenta contable");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la cuenta contable.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var cuentaContable = await _cuentaContableRepository.GetByIdAsync(id);
                if (cuentaContable == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("cuenta contable", id.ToString());
                }

                var eliminado = await _cuentaContableRepository.DeleteAsync(cuentaContable);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("cuenta contable");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: cuentaContable.Cuenta + " - " + cuentaContable.Descripcion);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.DatabaseError($"eliminar la cuenta contable");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.GetDetailedMessage());
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la cuenta contable.");
            }
        }
    }
}
