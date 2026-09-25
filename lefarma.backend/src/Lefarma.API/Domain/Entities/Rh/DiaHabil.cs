namespace Lefarma.API.Domain.Entities.Rh
{
    public class DiaHabil
    {
        public int IdDiaHabil { get; set; }
        public int IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Dia { get; set; }
        public DateTime Fecha { get; set; }
        public string? Descripcion { get; set; }
        public bool ConsumeSaldo { get; set; } = false;
        // Deprecada en la lógica: el saldo negativo siempre se permite. Se conserva mapeada
        // por si en el futuro se reincorporan días que no permitan saldo negativo. Siempre se guarda true.
        public bool PermiteSaldoNegativo { get; set; } = true;
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
    }
}
