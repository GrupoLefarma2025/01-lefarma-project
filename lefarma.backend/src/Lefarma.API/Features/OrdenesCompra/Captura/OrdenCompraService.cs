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

        public async Task<ErrorOr<IEnumerable<OrdenCompraResponse>>> GetAllAsync(OrdenCompraRequest query, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas)
        {
            try
            {
                var q = _repo.GetQueryable()
                    .Include(o => o.Partidas)
                    .Include(o => o.Proveedor)
                    .Include(o => o.CentroCosto)
                    .Include(o => o.CuentaContable)
                    .Include(o => o.Moneda)
                    .AsQueryable();

                if (query.IdEmpresa.HasValue) q = q.Where(o => o.IdEmpresa == query.IdEmpresa.Value);
                if (query.IdSucursal.HasValue) q = q.Where(o => o.IdSucursal == query.IdSucursal.Value);
                if (query.Estado.HasValue) q = q.Where(o => o.Estado == query.Estado.Value);

                // Si NO tiene el permiso de ver todas, filtrar por usuario/rol participante
                if (!puedeVerTodas)
                {
                    var rolesLista = rolesUsuario.ToList();

                    // Obtener los pasos del workflow donde el usuario es participante
                    // ya sea directamente (id_usuario) o por rol (id_rol)
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
                         o.Estado != EstadoOC.Creada &&
                         o.Estado != EstadoOC.Rechazada &&
                         o.Estado != EstadoOC.Cancelada));
                }

                q = query.OrderBy?.ToLower() switch
                {
                    "folio" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.Folio) : q.OrderByDescending(o => o.Folio),
                    "total" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.Total) : q.OrderByDescending(o => o.Total),
                    "fechacreacion" => query.OrderDirection?.ToLower() == "asc" ? q.OrderBy(o => o.FechaCreacion) : q.OrderByDescending(o => o.FechaCreacion),
                    _ => q.OrderByDescending(o => o.FechaCreacion)
                };

                var items = await q.ToListAsync();

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
                    return CommonErrors.NotFound("OrdenCompra", id.ToString());
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
                    IdUsuarioCreador = idUsuario,
                    Estado = EstadoOC.Creada,
                    IdPasoActual = pasoInicio?.IdPaso,
                    IdProveedor = request.IdProveedor,
                    IdsCuentasBancarias = request.IdsCuentasBancarias != null
                        ? System.Text.Json.JsonSerializer.Serialize(request.IdsCuentasBancarias)
                        : null,
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

                if (orden.Estado != EstadoOC.Creada)
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

                if (orden.Estado != EstadoOC.Creada)
                    return CommonErrors.Conflict("OrdenCompra", "Solo se pueden editar órdenes en estado Creada.");

                // Actualizar campos de la orden (no tocar IdOrden, Folio, IdUsuarioCreador, FechaSolicitud, Estado, IdPasoActual)
                orden.IdEmpresa = request.IdEmpresa;
                orden.IdSucursal = request.IdSucursal;
                orden.IdArea = request.IdArea;
                orden.IdTipoGasto = request.IdTipoGasto;
                orden.FechaLimitePago = request.FechaLimitePago;
                orden.IdProveedor = request.IdProveedor;
                orden.IdsCuentasBancarias = request.IdsCuentasBancarias != null
                    ? System.Text.Json.JsonSerializer.Serialize(request.IdsCuentasBancarias)
                    : null;
                orden.SinDatosFiscales = request.SinDatosFiscales;
                orden.NotaFormaPago = request.NotaFormaPago;
                orden.NotasGenerales = request.NotasGenerales;
                orden.IdMoneda = request.IdMoneda;
                orden.TipoCambioAplicado = request.TipoCambioAplicado > 0 ? request.TipoCambioAplicado : 1m;

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

        private static OrdenCompraResponse ToResponse(OrdenCompra o) => new()
        {
            IdOrden = o.IdOrden,
            Folio = o.Folio,
            IdEmpresa = o.IdEmpresa,
            IdSucursal = o.IdSucursal,
            IdArea = o.IdArea,
            IdTipoGasto = o.IdTipoGasto,
            IdsCuentasBancarias = string.IsNullOrEmpty(o.IdsCuentasBancarias)
                ? null
                : System.Text.Json.JsonSerializer.Deserialize<List<int>>(o.IdsCuentasBancarias),
            Estado = o.Estado.ToString(),
            IdPasoActual = o.IdPasoActual,
            IdProveedor = o.IdProveedor,
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
                IdsCuentasBancarias = p.IdsCuentasBancarias,
                RequiereFactura = p.RequiereFactura,
                TipoComprobante = p.TipoComprobante,
                CantidadFacturada = p.CantidadFacturada,
                ImporteFacturado = p.ImporteFacturado,
                EstadoFacturacion = p.EstadoFacturacion
            }).ToList()
        };
    }
}
