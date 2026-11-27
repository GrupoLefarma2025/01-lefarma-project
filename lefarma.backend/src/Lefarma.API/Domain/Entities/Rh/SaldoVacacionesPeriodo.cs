namespace Lefarma.API.Domain.Entities.Rh
{
    public class SaldoVacacionesPeriodo
    {
        public int IdSaldo { get; set; }
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public DateTime FechaInicioPeriodo { get; set; }
        public DateTime FechaFinPeriodo { get; set; }
        public DateTime FechaLimiteDisfrute { get; set; }
        public int NumeroPeriodo { get; set; }
        public decimal DiasGenerados { get; set; }
        public decimal DiasVencidos { get; set; }
        public decimal DiasCompensados { get; set; }
        public decimal DiasAjustados { get; set; }
        public decimal DiasAjustadosArrastre { get; set; }
        public decimal DiasTomados { get; set; }
        public decimal DiasPendientes { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public int? IdUsuarioModificacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        public string? HistorialAjustes { get; set; }
    }
}
