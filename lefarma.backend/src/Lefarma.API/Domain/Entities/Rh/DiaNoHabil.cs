namespace Lefarma.API.Domain.Entities.Rh
{
    public class DiaNoHabil
    {
        public int IdDiaNoHabil { get; set; }
        public int IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Dia { get; set; }
        public DateTime Fecha { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
    }
}
