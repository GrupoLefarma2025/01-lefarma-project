using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.Gastos
{
public class GastoService : BaseService, IGastoService
    {
        private readonly IGastoRepository _gastoRepository;
        private readonly ILogger<GastoService> _logger;
        protected override string EntityName => "Gastos";

        public GastoService(IGastoRepository gastoRepository,
            IWideEventAccessor wideEventAccessor, 
            ILogger<GastoService> logger) 
            : base(wideEventAccessor)
        {
            _gastoRepository = gastoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<GastoResponse>>> GetAllAsync(GastoRequest query)
        {
            try
            {
                IQueryable<Gasto> queryable = _gastoRepository.GetQueryable()
                    .Include(g => g.GastoUnidadesMedida)
                        .ThenInclude(gum => gum.UnidadMedida);

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(g => g.Nombre.Contains(query.Nombre));

                if (query.RequiereComprobacionPago.HasValue)
                    queryable = queryable.Where(g => g.RequiereComprobacionPago == query.RequiereComprobacionPago.Value);

                if (query.RequiereComprobacionGasto.HasValue)
                    queryable = queryable.Where(g => g.RequiereComprobacionGasto == query.RequiereComprobacionGasto.Value);

                if (query.Activo.HasValue)
                    queryable = queryable.Where(g => g.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(g => g.Nombre),
                    ("fechacreacion", "asc") => queryable.OrderBy(g => g.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(g => g.FechaCreacion),
                    _ => queryable.OrderBy(g => g.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Nombre, query.RequiereComprobacionPago, query.RequiereComprobacionGasto, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<GastoResponse>();
                }

                var response = result.Select(g => g.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Nombre, query.RequiereComprobacionPago, query.RequiereComprobacionGasto, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(g => g.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener los gastos");
            }
        }

        public async Task<ErrorOr<GastoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _gastoRepository.GetByIdConUnidadesAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("gasto", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"obtener el gasto");
            }
        }

        public async Task<ErrorOr<GastoResponse>> CreateAsync(CreateGastoRequest request)
        {
            try
            {
                var existeConcepto = await _gastoRepository.ExistsAsync(s => s.Concepto == request.Concepto);
                if (existeConcepto)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Concepto, duplicate: true);
                    return CommonErrors.AlreadyExists("gasto", "concepto", request.Concepto!);
                }

                var gasto = new Gasto
                {
                    Nombre = request.Nombre,
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Clave = request.Clave,
                    Concepto = request.Concepto,
                    Cuenta = request.Cuenta,
                    SubCuenta = request.SubCuenta,
                    Analitica = request.Analitica,
                    Integracion = request.Integracion,
                    RequiereComprobacionPago = request.RequiereComprobacionPago,
                    RequiereComprobacionGasto = request.RequiereComprobacionGasto,
                    PermiteSinDatosFiscales = request.PermiteSinDatosFiscales,
                    DiasLimiteComprobacion = request.DiasLimiteComprobacion ?? 0,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow,
                    CuentaCatalogo = $"{request.Cuenta}-{request.SubCuenta}-{request.Analitica}-{request.Integracion}"
                };

                var result = await _gastoRepository.AddAsync(gasto);

                await _gastoRepository.ActualizarUnidadesMedidaAsync(result.IdGasto, request.UnidadesMedida);

                EnrichWideEvent(action: "Create", entityId: result.IdGasto, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError($"guardar el gasto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al crear el gasto.");
            }
        }

        public async Task<ErrorOr<GastoResponse>> UpdateAsync(int id, UpdateGastoRequest request)
        {
            try
            {
                var gasto = await _gastoRepository.GetByIdAsync(id);
                if (gasto == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("gasto", id.ToString());
                }

                var existeConcepto = await _gastoRepository.ExistsAsync(s => s.Concepto == request.Concepto && s.IdGasto != id);
                if (existeConcepto)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Concepto, duplicate: true);
                    return CommonErrors.AlreadyExists("gasto", "concepto", request.Concepto!);
                }

                gasto.Nombre = request.Nombre;
                gasto.Descripcion = request.Descripcion;
                gasto.Clave = request.Clave;
                gasto.Concepto = request.Concepto;
                gasto.Cuenta = request.Cuenta;
                gasto.SubCuenta = request.SubCuenta;
                gasto.Analitica = request.Analitica;
                gasto.Integracion = request.Integracion;
                gasto.RequiereComprobacionPago = request.RequiereComprobacionPago;
                gasto.RequiereComprobacionGasto = request.RequiereComprobacionGasto;
                gasto.PermiteSinDatosFiscales = request.PermiteSinDatosFiscales;
                gasto.DiasLimiteComprobacion = request.DiasLimiteComprobacion ?? 0;
                gasto.Activo = request.Activo;
                gasto.FechaModificacion = DateTime.UtcNow;
                gasto.CuentaCatalogo = $"{gasto.Cuenta}-{gasto.SubCuenta}-{gasto.Analitica}-{gasto.Integracion}";

                var result = await _gastoRepository.UpdateAsync(gasto);

                await _gastoRepository.ActualizarUnidadesMedidaAsync(result.IdGasto, request.UnidadesMedida);

                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.ConcurrencyError("gasto");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"actualizar el gasto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar el gasto.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var gasto = await _gastoRepository.GetByIdAsync(id);
                if (gasto == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("gasto", id.ToString());
                }

                var eliminado = await _gastoRepository.DeleteAsync(gasto);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("gasto");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: gasto.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"eliminar el gasto");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar el gasto.");
            }
        }
    }
}
