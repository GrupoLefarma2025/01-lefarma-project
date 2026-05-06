namespace Lefarma.API.Features.Catalogos.CuentasContables.DTOs
{
    public class CuentaContableResponse
    {
        public int IdCuentaContable { get; set; }
        public string Cuenta { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string? DescripcionNormalizada { get; set; }
        public string Nivel1 { get; set; } = string.Empty;
        public string Nivel2 { get; set; } = string.Empty;
        public string? EmpresaPrefijo { get; set; }
        public int? EmpresaId { get; set; }
        public string? EmpresaNombre { get; set; }
        public int? CentroCostoId { get; set; }
        public string? CentroCostoNombre { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateCuentaContableRequest
    {
        public required string Cuenta { get; set; } = null!;
        public required string Descripcion { get; set; } = null!;
        public required string Nivel1 { get; set; } = null!;
        public required string Nivel2 { get; set; } = null!;
        public string? EmpresaPrefijo { get; set; }
        public int? EmpresaId { get; set; }
        public int? CentroCostoId { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateCuentaContableRequest
    {
        public required int IdCuentaContable { get; set; }
        public required string Cuenta { get; set; } = null!;
        public required string Descripcion { get; set; } = null!;
        public required string Nivel1 { get; set; } = null!;
        public required string Nivel2 { get; set; } = null!;
        public string? EmpresaPrefijo { get; set; }
        public int? EmpresaId { get; set; }
        public int? CentroCostoId { get; set; }
        public bool Activo { get; set; }
    }

    public class CuentaContableRequest
    {
        public string? Cuenta { get; set; }
        public string? Nivel1 { get; set; }
        public string? Nivel2 { get; set; }
        public int? CentroCostoId { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
