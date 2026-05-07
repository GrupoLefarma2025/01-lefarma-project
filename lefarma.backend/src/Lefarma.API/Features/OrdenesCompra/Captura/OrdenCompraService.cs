using ErrorOr;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
    public class OrdenCompraService : BaseService, IOrdenCompraService
    {
        private readonly IOrdenCompraRepository _repo;
        private readonly IWorkflowRepository _workflowRepo;
        private readonly IWorkflowResolver _workflowResolver;
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        protected override string EntityName => "OrdenCompra";

        public OrdenCompraService(
            IOrdenCompraRepository repo,
            IWorkflowRepository workflowRepo,
            IWorkflowResolver workflowResolver,
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repo = repo;
            _workflowRepo = workflowRepo;
            _workflowResolver = workflowResolver;
            _context = context;
            _asokamContext = asokamContext;
        }

        public async Task<ErrorOr<IEnumerable<OrdenCompraResponse>>> GetAllAsync(OrdenCompraRequest query, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas)
        {
            try
            {
                var q = _repo.GetQueryable().Include(o => o.Partidas).Include(o => o.Proveedor).Include(o => o.CentroCosto).Include(o => o.CuentaContable).Include(o => o.Empresa).Include(o => o.Sucursal).Include(o => o.Area).Include(o => o.Estado).AsQueryable();

                if (query.IdEmpresa.HasValue) q = q.Where(o => o.IdEmpresa == query.IdEmpresa.Value);
                if (query.IdSucursal.HasValue) q = q.Where(o => o.IdSucursal == query.IdSucursal.Value);
                if (query.IdEstado.HasValue) q = q.Where(o => o.IdEstado == query.IdEstado.Value);

                if (query.SoloEnvioConcentrado == true)
                {
                    var pasosConEnvioConcentrado = await _context.WorkflowAcciones
                        .Where(a => a.Activo && a.EnviaConcentrado)
                        .Select(a => a.IdPasoOrigen)
                        .Distinct()
                        .ToListAsync();

                    q = q.Where(o => o.IdPasoActual.HasValue && pasosConEnvioConcentrado.Contains(o.IdPasoActual.Value));
                }

                // Si NO tiene el permiso de ver todas, filtrar por usuario/rol participante
                if (!puedeVerTodas)
                {
                    var rolesLista = rolesUsuario.ToList();

                    // Obtener los pasos del workflow donde el usuario es participante ya sea directamente (id_usuario) o por rol (id_rol)
                    var pasosParticipante = await _context.WorkflowParticipantes
                        .Where(p => p.Activo && (
                            p.IdUsuario == idUsuario ||
                            (p.IdRol != null && rolesLista.Contains(p.IdRol.Value))
                        ))
                        .Select(p => p.IdPaso)
                        .Distinct()
                        .ToListAsync();

                    q = q.Where(o =>
                        o.IdUsuarioCreador == idUsuario ||
                        (pasosParticipante.Contains(o.IdPasoActual ?? 0) &&
                         o.IdEstado != 1 && // Creada
                         o.IdEstado != 7 && // Rechazada
                         o.IdEstado != 9)); // Cancelada
                }

                q = query.OrderBy?.ToLower() switch
                {
                    "folio" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.Folio) : q.OrderByDescending(o => o.Folio),
                    "total" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.Total) : q.OrderByDescending(o => o.Total),
                    "fechacreacion" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.FechaCreacion) : q.OrderByDescending(o => o.FechaCreacion),
                    _ => q.OrderByDescending(o => o.FechaCreacion)
                };

                if (query.Max.HasValue && query.Max.Value > 0)
                    q = q.Take(query.Max.Value);

                var items = await q.ToListAsync();

                var userIds = items.Select(o => o.IdUsuarioCreador).Distinct().ToList();
                var usuarioNombres = await _asokamContext.Usuarios.AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}");

                var uomIds = items.SelectMany(o => o.Partidas ?? Enumerable.Empty<OrdenCompraPartida>())
                                  .Select(p => p.IdUnidadMedida)
                                  .Distinct()
                                  .ToList();
                var uomNombres = await _context.UnidadesMedida.AsNoTracking()
                    .Where(u => uomIds.Contains(u.IdUnidadMedida))
                    .ToDictionaryAsync(u => u.IdUnidadMedida, u => u.Abreviatura ?? u.Nombre);

                var response = items.Select(o => ToResponse(o, usuarioNombres, uomNombres)).ToList();
                EnrichWideEvent("GetAll", count: response.Count);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener las órdenes de compra");
            }
        }

        public async Task<ErrorOr<OrdenCompraResponse>> GetByIdAsync(int id)
        {
            try
            {
                var item = await _repo.GetWithPartidasAsync(id);
                if (item is null)
                {
                    EnrichWideEvent("GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("OrdenCompra", id.ToString());
                }

                var usuarioNombres = new Dictionary<int, string>();
                var uNombre = await _asokamContext.Usuarios.AsNoTracking()
                    .Where(u => u.IdUsuario == item.IdUsuarioCreador)
                    .Select(u => new { u.IdUsuario, Nombre = u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}" })
                    .FirstOrDefaultAsync();
                if (uNombre != null) usuarioNombres[uNombre.IdUsuario] = uNombre.Nombre;

                var uomIds = (item.Partidas ?? Enumerable.Empty<OrdenCompraPartida>()).Select(p => p.IdUnidadMedida).Distinct().ToList();
                var uomNombres = await _context.UnidadesMedida.AsNoTracking()
                    .Where(u => uomIds.Contains(u.IdUnidadMedida))
                    .ToDictionaryAsync(u => u.IdUnidadMedida, u => u.Abreviatura ?? u.Nombre);

                return ToResponse(item, usuarioNombres, uomNombres);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("obtener la orden de compra");
            }
        }

        public async Task<ErrorOr<OrdenCompraResponse>> CreateAsync(CreateOrdenCompraRequest request, int idUsuario, CancellationToken ct = default)
        {
            try
            {
                var folio = await _repo.GenerarFolioAsync();
                var partidas = request.Partidas.Select((p, i) => new OrdenCompraPartida
                {
                    NumeroPartida = i + 1,
                    Descripcion = p.Descripcion.Trim(),
                    Cantidad = p.Cantidad,
                    IdUnidadMedida = p.IdUnidadMedida,
                    PrecioUnitario = p.PrecioUnitario,
                    Descuento = p.Descuento,
                    PorcentajeIva = p.PorcentajeIva,
                    TotalRetenciones = p.TotalRetenciones,
                    OtrosImpuestos = p.OtrosImpuestos,
                    Deducible = p.Deducible,
                    IdProveedor = p.IdProveedor,
                    IdsCuentasBancarias = p.IdsCuentasBancarias,
                    RequiereFactura = p.RequiereFactura,
                    TipoComprobante = p.TipoComprobante,
                    Total = CalcularTotalPartida(p)
                }).ToList();

                var subtotal = partidas.Sum(p => p.PrecioUnitario * p.Cantidad - p.Descuento);
                var totalIva = partidas.Sum(p => (p.PrecioUnitario * p.Cantidad - p.Descuento) * p.PorcentajeIva / 100);

                var workflow = await _workflowResolver.ResolveWorkflowIdAsync("ORDEN_COMPRA", idUsuario, request.IdEmpresa, request.IdSucursal, request.IdArea, request.IdTipoGasto, request.IdProveedor);

                if (workflow is null)
                    return CommonErrors.Conflict("Workflow", $"No existe un workflow activo para 'ORDEN_COMPRA'.");

                var pasoInicio = workflow.Pasos?.FirstOrDefault(p => p.EsInicio);
                if (pasoInicio is null)
                    return CommonErrors.Conflict("Workflow", "El workflow no tiene un paso inicial configurado.");

                var accionInicial = pasoInicio.AccionesOrigen?.OrderBy(a => a.IdAccion).FirstOrDefault();

                if (accionInicial is null)
                    return CommonErrors.Conflict("Workflow", "El paso inicial no tiene acciones configuradas para registrar bitácora.");

                var orden = new OrdenCompra
                {
                    Folio = folio,
                    IdEmpresa = request.IdEmpresa,
                    IdSucursal = request.IdSucursal,
                    IdArea = request.IdArea,
                    IdTipoGasto = request.IdTipoGasto ?? 0,
                    IdUsuarioCreador = idUsuario,
                    IdEstado = 1, // Creada
                    IdWorkflow = workflow.IdWorkflow,
                    IdPasoActual = pasoInicio?.IdPaso,
                    IdProveedor = request.IdProveedor,
                    IdsCuentasBancarias = SerializeCuentasYFormasPago(request.IdsCuentasBancarias, request.IdsFormaPago, request.NumeroMensualidades),
                    SinDatosFiscales = request.SinDatosFiscales,
                    NotaFormaPago = request.NotaFormaPago,
                    NotasGenerales = request.NotasGenerales,
                    IdMoneda = request.IdMoneda,
                    TipoCambioAplicado = request.TipoCambioAplicado > 0 ? request.TipoCambioAplicado : 1m,
                    FechaSolicitud = DateTime.UtcNow,
                    FechaLimitePago = request.FechaLimitePago,
                    FechaCreacion = DateTime.UtcNow,
                    Subtotal = subtotal,
                    TotalIva = totalIva,
                    TotalRetenciones = partidas.Sum(p => p.TotalRetenciones),
                    TotalOtrosImpuestos = partidas.Sum(p => p.OtrosImpuestos),
                    Total = partidas.Sum(p => p.Total),
                    Partidas = partidas
                };

                var result = await _repo.AddAsync(orden);

                var snapshot = new Dictionary<string, object?>
                {
                    ["idWorkflow"] = workflow.IdWorkflow,
                    ["idPasoAnterior"] = null,
                    ["idPasoNuevo"] = result.IdPasoActual,
                    ["idEstadoNuevo"] = result.IdEstado,
                    ["datosAdicionales"] = null
                };

                _context.WorkflowBitacoras.Add(new WorkflowBitacora
                {
                    IdOrden = result.IdOrden,
                    IdWorkflow = workflow.IdWorkflow,
                    IdPaso = pasoInicio.IdPaso,
                    IdAccion = accionInicial.IdAccion,
                    IdUsuario = idUsuario,
                    Comentario = "Orden de compra creada",
                    DatosSnapshot = System.Text.Json.JsonSerializer.Serialize(snapshot),
                    FechaEvento = result.FechaCreacion
                });

                await _context.SaveChangesAsync(ct);

                EnrichWideEvent("Create",entityId: result.IdOrden, nombre: result.Folio,
                    additionalContext: new Dictionary<string, object> { ["total"] = result.Total });

                return ToResponse(result);
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Create", exception: ex);
                return CommonErrors.DatabaseError("guardar la orden de compra");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Create", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al crear la orden de compra.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var orden = await _repo.GetByIdAsync(id);
                if (orden is null)
                {
                    EnrichWideEvent("Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("OrdenCompra", id.ToString());
                }

                if (orden.Estado?.IdEstado != 1) // 1 = Creada
                    return CommonErrors.Conflict("OrdenCompra", "Solo se pueden eliminar órdenes en estado Creada.");

                var eliminado = await _repo.DeleteAsync(orden);
                if (!eliminado)
                {
                    EnrichWideEvent("Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("OrdenCompra");
                }

                EnrichWideEvent("Delete", entityId: id, nombre: orden.Folio);
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Delete", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("eliminar la orden de compra");
            }
        }

        public async Task<ErrorOr<OrdenCompraResponse>> UpdateAsync(int id, CreateOrdenCompraRequest request, int idUsuario, CancellationToken ct = default)
        {
            try
            {
                var orden = await _repo.GetWithPartidasAsync(id);
                if (orden == null)
                    return CommonErrors.NotFound("OrdenCompra", id.ToString());

                if (orden.Estado?.IdEstado != 1) // 1 = Creada
                    return CommonErrors.Conflict("OrdenCompra", "Solo se pueden editar órdenes en estado Creada.");

                // Actualizar campos de la orden (no tocar IdOrden, Folio, IdUsuarioCreador, FechaSolicitud, Estado, IdPasoActual)
                orden.IdEmpresa = request.IdEmpresa;
                orden.IdSucursal = request.IdSucursal;
                orden.IdArea = request.IdArea;
                orden.IdTipoGasto = request.IdTipoGasto;
                orden.FechaLimitePago = request.FechaLimitePago;
                orden.IdProveedor = request.IdProveedor;
                orden.IdsCuentasBancarias = SerializeCuentasYFormasPago(request.IdsCuentasBancarias, request.IdsFormaPago, request.NumeroMensualidades);
                orden.SinDatosFiscales = request.SinDatosFiscales;
                orden.NotaFormaPago = request.NotaFormaPago;
                orden.NotasGenerales = request.NotasGenerales;
                orden.IdMoneda = request.IdMoneda;
                orden.TipoCambioAplicado = request.TipoCambioAplicado > 0 ? request.TipoCambioAplicado : 1m;

                // Recrear partidas: remover existentes y crear nuevas
                _context.OrdenesCompraPartidas.RemoveRange(orden.Partidas ?? Enumerable.Empty<OrdenCompraPartida>());
                var partidas = request.Partidas.Select((p, i) => new OrdenCompraPartida
                {
                    IdOrden = orden.IdOrden,
                    NumeroPartida = i + 1,
                    Descripcion = p.Descripcion.Trim(),
                    Cantidad = p.Cantidad,
                    IdUnidadMedida = p.IdUnidadMedida,
                    PrecioUnitario = p.PrecioUnitario,
                    Descuento = p.Descuento,
                    PorcentajeIva = p.PorcentajeIva,
                    TotalRetenciones = p.TotalRetenciones,
                    OtrosImpuestos = p.OtrosImpuestos,
                    Deducible = p.Deducible,
                    IdProveedor = p.IdProveedor,
                    IdsCuentasBancarias = p.IdsCuentasBancarias,
                    RequiereFactura = p.RequiereFactura,
                    TipoComprobante = p.TipoComprobante,
                    Total = CalcularTotalPartida(p)
                }).ToList();
                orden.Partidas = partidas;

                // Recalcular totales
                orden.Subtotal = partidas.Sum(p => p.PrecioUnitario * p.Cantidad - p.Descuento);
                orden.TotalIva = partidas.Sum(p => (p.PrecioUnitario * p.Cantidad - p.Descuento) * p.PorcentajeIva / 100);
                orden.TotalRetenciones = partidas.Sum(p => p.TotalRetenciones);
                orden.TotalOtrosImpuestos = partidas.Sum(p => p.OtrosImpuestos);
                orden.Total = partidas.Sum(p => p.Total);

                await _context.SaveChangesAsync(ct);

                EnrichWideEvent("Update",entityId: orden.IdOrden, nombre: orden.Folio);
                return ToResponse(orden);
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Update", exception: ex);
                return CommonErrors.DatabaseError("actualizar la orden de compra");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Update", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al actualizar la orden de compra.");
            }
        }

        private static decimal CalcularTotalPartida(CreatePartidaRequest p)
            => (p.PrecioUnitario * p.Cantidad - p.Descuento) * (1 + p.PorcentajeIva / 100) - p.TotalRetenciones + p.OtrosImpuestos;

        private static OrdenCompraResponse ToResponse(
            OrdenCompra o,
            Dictionary<int, string>? usuarioNombres = null,
            Dictionary<int, string>? uomNombres = null) => new()
        {
            IdOrden = o.IdOrden,
            Folio = o.Folio,
            IdEmpresa = o.IdEmpresa,
            EmpresaNombre = o.Empresa?.NombreNormalizado ?? o.Empresa?.Nombre,
            IdSucursal = o.IdSucursal,
            SucursalNombre = o.Sucursal?.NombreNormalizado ?? o.Sucursal?.Nombre,
            IdArea = o.IdArea,
            AreaNombre = o.Area?.NombreNormalizado ?? o.Area?.Nombre,
            IdTipoGasto = o.IdTipoGasto ?? 0,
            IdsCuentasBancarias = string.IsNullOrEmpty(o.IdsCuentasBancarias)
                ? null
                : DeserializeCuentasYFormasPago(o.IdsCuentasBancarias)?.IdsCuentasBancarias,
            IdsFormaPago = string.IsNullOrEmpty(o.IdsCuentasBancarias)
                ? null
                : DeserializeCuentasYFormasPago(o.IdsCuentasBancarias)?.IdsFormaPago,
            NumeroMensualidades = string.IsNullOrEmpty(o.IdsCuentasBancarias)
                ? null
                : DeserializeCuentasYFormasPago(o.IdsCuentasBancarias)?.NumeroMensualidades,
            IdEstado = o.IdEstado,
            EstadoNombre = o.Estado?.Nombre,
            EstadoColor = o.Estado?.ColorHex,
            IdWorkflow = o.IdWorkflow,
            IdPasoActual = o.IdPasoActual,
            IdProveedor = o.IdProveedor,
            RazonSocialProveedor = o.Proveedor?.RazonSocial,
            IdUsuarioCreador = o.IdUsuarioCreador,
            SolicitanteNombre = usuarioNombres != null && usuarioNombres.TryGetValue(o.IdUsuarioCreador, out var sn) ? sn : null,
            SinDatosFiscales = o.SinDatosFiscales,
            NotaFormaPago = o.NotaFormaPago,
            NotasGenerales = o.NotasGenerales,
            IdCentroCosto = o.IdCentroCosto,
            CentroCostoNombre = o.CentroCosto?.Nombre,
            IdCuentaContable = o.IdCuentaContable,
            CuentaContableNumero = o.CuentaContable?.Cuenta,
            CuentaContableDescripcion = o.CuentaContable?.Descripcion,
            RequiereComprobacionPago = o.RequiereComprobacionPago,
            RequiereComprobacionGasto = o.RequiereComprobacionGasto,
            FechaSolicitud = o.FechaSolicitud,
            FechaLimitePago = o.FechaLimitePago,
            Subtotal = o.Subtotal,
            TotalIva = o.TotalIva,
            Total = o.Total,
            IdMoneda = o.IdMoneda,
            MonedaCodigo = o.Moneda?.Codigo,
            MonedaSimbolo = o.Moneda?.Simbolo,
            TipoCambioAplicado = o.TipoCambioAplicado,
            Partidas = (o.Partidas ?? Enumerable.Empty<OrdenCompraPartida>()).OrderBy(p => p.NumeroPartida).Select(p => new OrdenCompraPartidaResponse
            {
                IdPartida = p.IdPartida,
                NumeroPartida = p.NumeroPartida,
                Descripcion = p.Descripcion,
                Cantidad = p.Cantidad,
                IdUnidadMedida = p.IdUnidadMedida,
                UnidadMedidaNombre = uomNombres != null && uomNombres.TryGetValue(p.IdUnidadMedida, out var un) ? un : null,
                PrecioUnitario = p.PrecioUnitario,
                Descuento = p.Descuento,
                PorcentajeIva = p.PorcentajeIva,
                TotalRetenciones = p.TotalRetenciones,
                OtrosImpuestos = p.OtrosImpuestos,
                Deducible = p.Deducible,
                Total = p.Total,
                IdProveedor = p.IdProveedor,
                IdsCuentasBancarias = p.IdsCuentasBancarias,
                RequiereFactura = p.RequiereFactura,
                TipoComprobante = p.TipoComprobante,
                CantidadFacturada = p.CantidadFacturada,
                ImporteFacturado = p.ImporteFacturado,
                EstadoFacturacion = p.EstadoFacturacion
            }).ToList()
        };

        private static string? SerializeCuentasYFormasPago(List<int>? idsCuentas, List<int>? idsFormasPago, int? numeroMensualidades)
        {
            if (idsCuentas == null && idsFormasPago == null && numeroMensualidades == null) return null;
            var obj = new CuentasBancariasYFormasPago
            {
                IdsCuentasBancarias = idsCuentas ?? new List<int>(),
                IdsFormaPago = idsFormasPago ?? new List<int>(),
                NumeroMensualidades = numeroMensualidades
            };
            return System.Text.Json.JsonSerializer.Serialize(obj);
        }

        private static CuentasBancariasYFormasPago? DeserializeCuentasYFormasPago(string? json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<CuentasBancariasYFormasPago>(json);
            }
            catch
            {
                try
                {
                    var idsAntiguo = System.Text.Json.JsonSerializer.Deserialize<List<int>>(json);
                    return new CuentasBancariasYFormasPago { IdsCuentasBancarias = idsAntiguo ?? new List<int>() };
                }
                catch
                {
                    return null;
                }
            }
        }
    }
}
