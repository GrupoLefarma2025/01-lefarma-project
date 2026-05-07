using ErrorOr;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Features.Dashboard.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Dashboard
{
    public class DashboardService : BaseService, IDashboardService
    {
        private readonly ApplicationDbContext _db;
        private readonly AsokamDbContext _asokamDb;
        protected override string EntityName => "Dashboard";

        public DashboardService(
            ApplicationDbContext db,
            AsokamDbContext asokamDb,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _db = db;
            _asokamDb = asokamDb;
        }

        public async Task<ErrorOr<DashboardStatsResponse>> GetStatsAsync()
        {
            try
            {
                var estados = await _db.WorkflowEstados
                    .Where(e => e.Activo)
                    .ToDictionaryAsync(e => e.Codigo!, e => e.IdEstado);
                var cards = await GetCardsAsync(estados);
                var graficaMensual = await GetGraficaMensualAsync(estados);
                var pagosUrgentes = await GetPagosUrgentesAsync(estados);

                var distribucionEmpresa = await GetDistribucionEmpresaAsync();
                var distribucionSucursal = await GetDistribucionSucursalAsync();
                var actividadReciente = await GetActividadRecienteAsync();

                return new DashboardStatsResponse
                {
                    Cards = cards,
                    GraficaMensual = graficaMensual,
                    DistribucionEmpresa = distribucionEmpresa,
                    DistribucionSucursal = distribucionSucursal,
                    PagosUrgentes = pagosUrgentes,
                    ActividadReciente = actividadReciente
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetStats", exception: ex);
                return Error.Failure("Dashboard.GetStats.Error", "Error al obtener las estadisticas del dashboard.");
            }
        }

        private async Task<PipelineCardsStats> GetCardsAsync(Dictionary<string, int> estados)
        {
            var today = DateTime.UtcNow;
            var startOfMonth = new DateTime(today.Year, today.Month, 1);

            int idCreada = estados.GetValueOrDefault("CREADA");
            int idRevision = estados.GetValueOrDefault("REVISION");
            int idRevisionDirector = estados.GetValueOrDefault("REVISION_DIRECTOR");
            int idCerrada = estados.GetValueOrDefault("CERRADA");
            int idPagada = estados.GetValueOrDefault("PAGADA");
            int idCancelada = estados.GetValueOrDefault("CANCELADA");
            int idRechazada = estados.GetValueOrDefault("RECHAZADA");

            var allOrdenes = await _db.OrdenesCompra
                .Select(oc => new { oc.IdEstado, oc.FechaLimitePago, oc.FechaCreacion, oc.Total, oc.TipoCambioAplicado })
                .ToListAsync();

            var pendientesEnvio = allOrdenes.Count(oc => oc.IdEstado == idCreada);
            var enFirmas = allOrdenes.Count(oc => oc.IdEstado == idRevision);
            var revisionDirector = allOrdenes.Count(oc => oc.IdEstado == idRevisionDirector);
            var cerradas = allOrdenes.Count(oc => oc.IdEstado == idCerrada || oc.IdEstado == idPagada);
            var canceladas = allOrdenes.Count(oc => oc.IdEstado == idCancelada);
            var rechazadas = allOrdenes.Count(oc => oc.IdEstado == idRechazada);

            var idsTerminados = new[] { idCerrada, idPagada, idCancelada, idRechazada };
            var vencidas = allOrdenes.Count(oc => !idsTerminados.Contains(oc.IdEstado) && oc.FechaLimitePago < today);

            var totalCreadasMes = allOrdenes.Count(oc => oc.FechaCreacion >= startOfMonth);

            var totalGastado = allOrdenes
                .Where(oc => oc.IdEstado == idCerrada || oc.IdEstado == idPagada)
                .Sum(oc => oc.Total * oc.TipoCambioAplicado);

            return new PipelineCardsStats
            {
                PendientesEnvio = pendientesEnvio,
                EnFirmas = enFirmas,
                RevisionDirector = revisionDirector,
                Cerradas = cerradas,
                Canceladas = canceladas,
                Rechazadas = rechazadas,
                Vencidas = vencidas,
                TotalCreadasMes = totalCreadasMes,
                TotalGastado = totalGastado
            };
        }

        private async Task<List<GraficaMensualItem>> GetGraficaMensualAsync(Dictionary<string, int> estados)
        {
            var now = DateTime.UtcNow;
            var startDate = new DateTime(now.Year, now.Month, 1).AddMonths(-5);

            var presupuestoTotal = await _db.CentrosCosto
                .Where(cc => cc.Activo && cc.LimitePresupuesto.HasValue)
                .SumAsync(cc => cc.LimitePresupuesto ?? 0m);

            var idPagada = estados.GetValueOrDefault("PAGADA");
            var idCerrada = estados.GetValueOrDefault("CERRADA");
            var idsPagados = new[] { idPagada, idCerrada };

            var ocData = await _db.OrdenesCompra
                .Where(oc => oc.FechaCreacion >= startDate)
                .Select(oc => new { oc.FechaCreacion, oc.Total, oc.TipoCambioAplicado, oc.IdEstado })
                .ToListAsync();

            var result = new List<GraficaMensualItem>();

            for (int i = -5; i <= 0; i++)
            {
                var targetDate = now.AddMonths(i);
                var year = targetDate.Year;
                var month = targetDate.Month;

                var monthData = ocData
                    .Where(oc => oc.FechaCreacion.Year == year && oc.FechaCreacion.Month == month)
                    .ToList();

                var solicitado = monthData.Sum(oc => oc.Total * oc.TipoCambioAplicado);
                var pagado = monthData
                    .Where(oc => idsPagados.Contains(oc.IdEstado))
                    .Sum(oc => oc.Total * oc.TipoCambioAplicado);

                result.Add(new GraficaMensualItem
                {
                    Mes = targetDate.ToString("MMMM", new System.Globalization.CultureInfo("es-MX")),
                    Presupuesto = presupuestoTotal,
                    Solicitado = solicitado,
                    Pagado = pagado
                });
            }

            return result;
        }

        private async Task<List<DistribucionItem>> GetDistribucionEmpresaAsync()
        {
            var ocData = await _db.OrdenesCompra
                .Select(oc => new { oc.IdEmpresa, oc.Total, oc.TipoCambioAplicado })
                .ToListAsync();

            var empresas = await _db.Empresas
                .Select(e => new { e.IdEmpresa, e.RazonSocial })
                .ToDictionaryAsync(e => e.IdEmpresa, e => e.RazonSocial);

            return ocData
                .GroupBy(oc => empresas.TryGetValue(oc.IdEmpresa, out var nombre) ? nombre : "Sin empresa")
                .Select(g => new DistribucionItem { Name = g.Key, Value = g.Sum(x => x.Total * x.TipoCambioAplicado) })
                .OrderByDescending(x => x.Value)
                .Take(8)
                .ToList();
        }

        private async Task<List<DistribucionItem>> GetDistribucionSucursalAsync()
        {
            var ocData = await _db.OrdenesCompra
                .Select(oc => new { oc.IdSucursal, oc.Total, oc.TipoCambioAplicado })
                .ToListAsync();

            var sucursales = await _db.Sucursales
                .Select(s => new { s.IdSucursal, s.Nombre })
                .ToDictionaryAsync(s => s.IdSucursal, s => s.Nombre);

            return ocData
                .GroupBy(oc => sucursales.TryGetValue(oc.IdSucursal, out var nombre) ? nombre : "Sin sucursal")
                .Select(g => new DistribucionItem { Name = g.Key, Value = g.Sum(x => x.Total * x.TipoCambioAplicado) })
                .OrderByDescending(x => x.Value)
                .Take(8)
                .ToList();
        }

        private async Task<List<PagoUrgenteItem>> GetPagosUrgentesAsync(Dictionary<string, int> estados)
        {
            var today = DateTime.UtcNow;
            var idTesoreria = estados.GetValueOrDefault("TESORERIA");

            var orders = await _db.OrdenesCompra
                .Where(oc => oc.IdEstado == idTesoreria)
                .OrderBy(oc => oc.FechaLimitePago)
                .Take(5)
                .Select(oc => new
                {
                    oc.IdOrden,
                    oc.Folio,
                    oc.Total,
                    oc.TipoCambioAplicado,
                    oc.FechaLimitePago,
                    oc.IdProveedor
                })
                .ToListAsync();

            var proveedorIds = orders
                .Where(o => o.IdProveedor.HasValue)
                .Select(o => o.IdProveedor!.Value)
                .Distinct()
                .ToList();

            var proveedores = await _db.Proveedores
                .Where(p => proveedorIds.Contains(p.IdProveedor))
                .Select(p => new { p.IdProveedor, p.RazonSocial })
                .ToDictionaryAsync(p => p.IdProveedor, p => p.RazonSocial);

            return orders.Select(o =>
            {
                var nombreProveedor = o.IdProveedor.HasValue && proveedores.TryGetValue(o.IdProveedor.Value, out var rs)
                    ? rs
                    : "Sin proveedor";

                var diasRestantes = (o.FechaLimitePago - today).TotalDays;

                return new PagoUrgenteItem
                {
                    Id = o.IdOrden,
                    Folio = o.Folio,
                    Proveedor = nombreProveedor,
                    Monto = o.Total * o.TipoCambioAplicado,
                    FechaLimitePago = o.FechaLimitePago,
                    Status = diasRestantes <= 2 ? "Urgente" : "Normal"
                };
            }).ToList();
        }

        private async Task<List<ActividadRecienteItem>> GetActividadRecienteAsync()
        {
            var bitacoras = await _db.WorkflowBitacoras
                .OrderByDescending(b => b.FechaEvento)
                .Take(10)
                .Select(b => new
                {
                    b.IdEvento,
                    b.IdOrden,
                    b.IdUsuario,
                    b.IdAccion,
                    b.FechaEvento
                })
                .ToListAsync();

            var usuarioIds = bitacoras.Select(b => b.IdUsuario).Distinct().ToList();
            var accionIds = bitacoras.Select(b => b.IdAccion).Distinct().ToList();
            var ordenIds = bitacoras.Select(b => b.IdOrden).Distinct().ToList();

            var usuarios = await _asokamDb.Usuarios
                .Where(u => usuarioIds.Contains(u.IdUsuario))
                .Select(u => new { u.IdUsuario, u.NombreCompleto, u.SamAccountName })
                .ToDictionaryAsync(u => u.IdUsuario);

            var acciones = await _db.WorkflowAcciones
                .Where(a => accionIds.Contains(a.IdAccion))
                .Include(a => a.TipoAccion)
                .Select(a => new { a.IdAccion, NombreAccion = a.TipoAccion != null ? a.TipoAccion.Nombre : null, CodigoTipoAccion = a.TipoAccion != null ? a.TipoAccion.Codigo : null })
                .ToDictionaryAsync(a => a.IdAccion);

            var ordenes = await _db.OrdenesCompra
                .Where(oc => ordenIds.Contains(oc.IdOrden))
                .Select(oc => new { oc.IdOrden, oc.Folio })
                .ToDictionaryAsync(oc => oc.IdOrden);

            return bitacoras.Select(b =>
            {
                var usuarioNombre = usuarios.TryGetValue(b.IdUsuario, out var u)
                    ? (u.NombreCompleto ?? u.SamAccountName ?? "Desconocido")
                    : "Desconocido";

                var accionNombre = acciones.TryGetValue(b.IdAccion, out var a)
                    ? a.NombreAccion
                    : "Accion desconocida";

                var tipoAccion = acciones.TryGetValue(b.IdAccion, out var ac)
                    ? MapTipo(ac.CodigoTipoAccion)
                    : "info";

                var folio = ordenes.TryGetValue(b.IdOrden, out var oc)
                    ? oc.Folio
                    : $"OC-{b.IdOrden}";

                return new ActividadRecienteItem
                {
                    Id = b.IdEvento,
                    Usuario = usuarioNombre,
                    Accion = accionNombre,
                    Entidad = folio,
                    FechaEvento = b.FechaEvento,
                    Tipo = tipoAccion
                };
            }).ToList();
        }

        private static string MapTipo(string tipoAccion) => tipoAccion switch
        {
            "APROBACION" => "success",
            "RECHAZO" => "error",
            "RETORNO" => "warning",
            _ => "info"
        };
    }
}
