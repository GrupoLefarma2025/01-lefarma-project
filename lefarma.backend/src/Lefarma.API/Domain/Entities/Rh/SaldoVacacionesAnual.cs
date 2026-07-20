namespace Lefarma.API.Domain.Entities.Rh
{
    public class SaldoVacacionesAnual
    {
        public int IdSaldo { get; set; }
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public int Anio { get; set; }
        public decimal DiasGenerados { get; set; }
        public decimal DiasVencidos { get; set; }
        public decimal DiasCompensados { get; set; }
        public decimal DiasAjustados { get; set; }
        public decimal DiasTomados { get; set; }
        public decimal DiasPendientes { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
    }
}
