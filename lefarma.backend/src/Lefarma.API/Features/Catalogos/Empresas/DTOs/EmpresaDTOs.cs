namespace Lefarma.API.Features.Catalogos.Empresas.DTOs
{
    public class EmpresaResponse
    {
        public int IdEmpresa { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public string RazonSocial { get; set; } = string.Empty;
        public string RFC { get; set; } = string.Empty;
        public string Direccion { get; set; } = string.Empty;
        public string Colonia { get; set; } = string.Empty;
        public string Ciudad { get; set; } = string.Empty;
        public string Estado { get; set; } = string.Empty;
        public string CodigoPostal { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PaginaWeb { get; set; } = string.Empty;
        public int? NumeroEmpleados { get; set; }
        public bool Activo { get; set; }
        public bool PuedeSeleccionarEmpresas { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class EmpresaRequest
    {
        public string? Nombre { get; set; }
        public string? RFC { get; set; }
        public string? Ciudad { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; } = "Nombre";
        public string? OrderDirection { get; set; } = "asc";
    }

    public class CreateEmpresaRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public string? RazonSocial { get; set; }
        public string? RFC { get; set; }
        public string? Direccion { get; set; }
        public string? Colonia { get; set; }
        public string? Ciudad { get; set; }
        public string? Estado { get; set; }
        public string? CodigoPostal { get; set; }
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? PaginaWeb { get; set; }
        public int? NumeroEmpleados { get; set; }
        public bool Activo { get; set; } = true;
        public bool PuedeSeleccionarEmpresas { get; set; } = false;
    }

    public class UpdateEmpresaRequest
    {
        public required int IdEmpresa { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public string? RazonSocial { get; set; }
        public string? RFC { get; set; }
        public string? Direccion { get; set; }
        public string? Colonia { get; set; }
        public string? Ciudad { get; set; }
        public string? Estado { get; set; }
        public string? CodigoPostal { get; set; }
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? PaginaWeb { get; set; }
        public int? NumeroEmpleados { get; set; }
        public bool Activo { get; set; }
        public bool PuedeSeleccionarEmpresas { get; set; }
    }
}
