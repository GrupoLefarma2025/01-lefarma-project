namespace Lefarma.API.Features.Dashboard.DTOs
{
    public class DashboardStatsResponse
    {
        public PipelineCardsStats Cards { get; set; } = null!;
        public List<GraficaMensualItem> GraficaMensual { get; set; } = [];
        public List<DistribucionItem> DistribucionEmpresa { get; set; } = [];
        public List<DistribucionItem> DistribucionSucursal { get; set; } = [];
        public List<PagoUrgenteItem> PagosUrgentes { get; set; } = [];
        public List<ActividadRecienteItem> ActividadReciente { get; set; } = [];
    }

    public class PipelineCardsStats
    {
        public int PendientesEnvio { get; set; }
        public int EnFirmas { get; set; }
        public int RevisionDirector { get; set; }
        public int Cerradas { get; set; }
        public int Canceladas { get; set; }
        public int Rechazadas { get; set; }
        public int Vencidas { get; set; }
        public int TotalCreadasMes { get; set; }
        public decimal TotalGastado { get; set; }
    }

    public class GraficaMensualItem
    {
        public string Mes { get; set; } = null!;
        public decimal Presupuesto { get; set; }
        public decimal Solicitado { get; set; }
        public decimal Pagado { get; set; }
    }

    public class DistribucionItem
    {
        public string Name { get; set; } = null!;
        public decimal Value { get; set; }
    }

    public class PagoUrgenteItem
    {
        public int Id { get; set; }
        public string Folio { get; set; } = null!;
        public string Proveedor { get; set; } = null!;
        public decimal Monto { get; set; }
        public DateTime FechaLimitePago { get; set; }
        public string Status { get; set; } = null!;
    }

    public class ActividadRecienteItem
    {
        public int Id { get; set; }
        public string Usuario { get; set; } = null!;
        public string Accion { get; set; } = null!;
        public string Entidad { get; set; } = null!;
        public DateTime FechaEvento { get; set; }
        public string Tipo { get; set; } = null!;
    }
}
