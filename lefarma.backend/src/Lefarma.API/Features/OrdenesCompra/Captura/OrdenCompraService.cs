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

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
    public class OrdenCompraService : BaseService, IOrdenCompraService
    {
        private readonly IOrdenCompraRepository _repo;
        private readonly IWorkflowRepository _workflowRepo;
        private readonly ApplicationDbContext _context;
        protected override string EntityName => "OrdenCompra";
        private const string CODIGO_PROCESO = "ORDEN_COMPRA";

        public OrdenCompraService(
            IOrdenCompraRepository repo,
            IWorkflowRepository workflowRepo,
            ApplicationDbContext context,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repo = repo;
            _workflowRepo = workflowRepo;
            _context = context;
        }

        public async Task<ErrorOr<IEnumerable<OrdenCompraResponse>>> GetAllAsync(OrdenCompraRequest query, int idUsuario)
        {
            try
            {
                var q = _repo.GetQueryable().Include(o => o.Partidas).Include(o => o.Proveedor).Include(o => o.CentroCosto).Include(o => o.CuentaContable).AsQueryable();

                if (query.IdEmpresa.HasValue) q = q.Where(o => o.IdEmpresa == query.IdEmpresa.Value);
                if (query.IdSucursal.HasValue) q = q.Where(o => o.IdSucursal == query.IdSucursal.Value);
                if (query.Estado.HasValue) q = q.Where(o => o.Estado == query.Estado.Value);

                q = query.OrderBy?.ToLower() switch
                {
                    "folio" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.Folio) : q.OrderByDescending(o => o.Folio),
                    "total" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.Total) : q.OrderByDescending(o => o.Total),
                    "fechacreacion" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.FechaCreacion) : q.OrderByDescending(o => o.FechaCreacion),
                    _ => q.OrderByDescending(o => o.FechaCreacion)
                };

                var items = await q.ToListAsync();
                if (!items.Any())
                {
                    EnrichWideEvent("GetAll", count: 0);
                    return CommonErrors.NotFound("OrdenesCompra");
                }

                var response = items.Select(ToResponse).ToList();
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
                    return CommonErrors.NotFound("orden de compra", id.ToString());
                }

                EnrichWideEvent("GetById", entityId: id, nombre: item.Folio);
                return ToResponse(item);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("obtener la orden de compra");
            }
        }

        public async Task<ErrorOr<OrdenCompraResponse>> CreateAsync(CreateOrdenCompraRequest request, int idUsuario)
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
                    RequiereFactura = p.RequiereFactura,
                    TipoComprobante = p.TipoComprobante,
                    Total = CalcularTotalPartida(p)
                }).ToList();

                var subtotal = partidas.Sum(p => p.PrecioUnitario * p.Cantidad - p.Descuento);
                var totalIva = partidas.Sum(p => (p.PrecioUnitario * p.Cantidad - p.Descuento) * p.PorcentajeIva / 100);

                var workflow = await _workflowRepo.GetQueryable()
                    .Include(w => w.Pasos)
                        .ThenInclude(p => p.AccionesOrigen)
                    .FirstOrDefaultAsync(w => w.CodigoProceso == CODIGO_PROCESO && w.Activo);

                if (workflow is null)
                    return CommonErrors.Conflict("Workflow", $"No existe un workflow activo para '{CODIGO_PROCESO}'.");

                var pasoInicio = workflow.Pasos.FirstOrDefault(p => p.EsInicio);
                if (pasoInicio is null)
                    return CommonErrors.Conflict("Workflow", "El workflow no tiene un paso inicial configurado.");

                var accionInicial = pasoInicio.AccionesOrigen
                    .OrderBy(a => a.IdAccion)
                    .FirstOrDefault();

                if (accionInicial is null)
                    return CommonErrors.Conflict("Workflow", "El paso inicial no tiene acciones configuradas para registrar bitácora.");

                var orden = new OrdenCompra
                {
                    Folio = folio,
                    IdEmpresa = request.IdEmpresa,
                    IdSucursal = request.IdSucursal,
                    IdArea = request.IdArea,
                    IdTipoGasto = request.IdTipoGasto,
                    IdFormaPago = request.IdFormaPago,
                    IdUsuarioCreador = idUsuario,
                    Estado = EstadoOC.Creada,
                    IdPasoActual = pasoInicio?.IdPaso,
                    IdProveedor = request.IdProveedor,
                    SinDatosFiscales = request.SinDatosFiscales,
                    RazonSocialProveedor = request.RazonSocialProveedor,
                    RfcProveedor = request.RfcProveedor,
                    CodigoPostalProveedor = request.CodigoPostalProveedor,
                    IdRegimenFiscal = request.IdRegimenFiscal,
                    PersonaContacto = request.PersonaContacto,
                    NotaFormaPago = request.NotaFormaPago,
                    NotasGenerales = request.NotasGenerales,
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
                    ["idPasoAnterior"] = null,
                    ["idPasoNuevo"] = result.IdPasoActual,
                    ["codigoEstadoNuevo"] = result.Estado.ToString(),
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

                await _context.SaveChangesAsync();

                EnrichWideEvent("Create", entityId: result.IdOrden, nombre: result.Folio,
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
                    return CommonErrors.NotFound("orden de compra", id.ToString());
                }

                if (orden.Estado != EstadoOC.Creada)
                    return CommonErrors.Conflict("OrdenCompra", "Solo se pueden eliminar órdenes en estado Creada.");

                var eliminado = await _repo.DeleteAsync(orden);
                if (!eliminado)
                {
                    EnrichWideEvent("Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("orden de compra");
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

        public async Task<ErrorOr<OrdenCompraResponse>> UpdateAsync(int id, CreateOrdenCompraRequest request, int idUsuario)
        {
            try
            {
                var orden = await _repo.GetWithPartidasAsync(id);
                if (orden == null)
                    return CommonErrors.NotFound("orden de compra", id.ToString());

                if (orden.Estado != EstadoOC.Creada)
                    return CommonErrors.Conflict("OrdenCompra", "Solo se pueden editar órdenes en estado Creada.");

                // Actualizar campos de la orden (no tocar IdOrden, Folio, IdUsuarioCreador, FechaSolicitud, Estado, IdPasoActual)
                orden.IdEmpresa = request.IdEmpresa;
                orden.IdSucursal = request.IdSucursal;
                orden.IdArea = request.IdArea;
                orden.IdTipoGasto = request.IdTipoGasto;
                orden.IdFormaPago = request.IdFormaPago;
                orden.FechaLimitePago = request.FechaLimitePago;
                orden.IdProveedor = request.IdProveedor;
                orden.SinDatosFiscales = request.SinDatosFiscales;
                orden.RazonSocialProveedor = request.RazonSocialProveedor;
                orden.RfcProveedor = request.RfcProveedor;
                orden.CodigoPostalProveedor = request.CodigoPostalProveedor;
                orden.IdRegimenFiscal = request.IdRegimenFiscal;
                orden.PersonaContacto = request.PersonaContacto;
                orden.NotaFormaPago = request.NotaFormaPago;
                orden.NotasGenerales = request.NotasGenerales;

                // Recrear partidas: remover existentes y crear nuevas
                _context.OrdenesCompraPartidas.RemoveRange(orden.Partidas);
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

                await _context.SaveChangesAsync();

                EnrichWideEvent("Update", entityId: orden.IdOrden, nombre: orden.Folio);
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

        private static OrdenCompraResponse ToResponse(OrdenCompra o) => new()
        {
            IdOrden = o.IdOrden,
            Folio = o.Folio,
            IdEmpresa = o.IdEmpresa,
            IdSucursal = o.IdSucursal,
            IdArea = o.IdArea,
            IdTipoGasto = o.IdTipoGasto,
            IdFormaPago = o.IdFormaPago,
            Estado = o.Estado.ToString(),
            IdPasoActual = o.IdPasoActual,
            IdProveedor = o.IdProveedor,
            SinDatosFiscales = o.SinDatosFiscales,
            RazonSocialProveedor = o.RazonSocialProveedor,
            RfcProveedor = o.RfcProveedor,
            CodigoPostalProveedor = o.CodigoPostalProveedor,
            IdRegimenFiscal = o.IdRegimenFiscal,
            PersonaContacto = o.PersonaContacto,
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
            Partidas = o.Partidas.OrderBy(p => p.NumeroPartida).Select(p => new OrdenCompraPartidaResponse
            {
                IdPartida = p.IdPartida,
                NumeroPartida = p.NumeroPartida,
                Descripcion = p.Descripcion,
                Cantidad = p.Cantidad,
                IdUnidadMedida = p.IdUnidadMedida,
                PrecioUnitario = p.PrecioUnitario,
                Descuento = p.Descuento,
                PorcentajeIva = p.PorcentajeIva,
                TotalRetenciones = p.TotalRetenciones,
                OtrosImpuestos = p.OtrosImpuestos,
                Deducible = p.Deducible,
                Total = p.Total,
                IdProveedor = p.IdProveedor,
                RequiereFactura = p.RequiereFactura,
                TipoComprobante = p.TipoComprobante,
                CantidadFacturada = p.CantidadFacturada,
                ImporteFacturado = p.ImporteFacturado,
                EstadoFacturacion = p.EstadoFacturacion
            }).ToList()
        };
    }
}
