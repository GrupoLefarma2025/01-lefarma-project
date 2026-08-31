using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Entities.Rh
{
    public class DiaUsuario
    {
        public int IdDiaUsuario { get; set; }
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Dia { get; set; }
        public DateTime Fecha { get; set; }
        public int IdTipoDia { get; set; }
        public string Origen { get; set; } = null!;
        public string? Estado { get; set; }
        public bool ConsumeSaldo { get; set; }
        public int? IdDiaNoHabil { get; set; }
        public string? Comentarios { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }

        public TipoDia? TipoDia { get; set; }
    }
}
