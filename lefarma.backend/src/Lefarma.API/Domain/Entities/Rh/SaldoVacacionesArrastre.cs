namespace Lefarma.API.Domain.Entities.Rh
{
    public class SaldoVacacionesArrastre
    {
        public int IdArrastre { get; set; }
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public DateTime FechaCorte { get; set; }
        public decimal DiasTotal { get; set; }
        public decimal DiasAplicados { get; set; }
        public decimal DiasRestante { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        public int? IdUsuarioModificacion { get; set; }
    }
}
