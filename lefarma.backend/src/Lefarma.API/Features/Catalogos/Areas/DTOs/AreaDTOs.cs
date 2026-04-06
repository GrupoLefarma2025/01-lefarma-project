namespace Lefarma.API.Features.Catalogos.Areas.DTOs
{
public class AreaResponse
    {
        public int IdArea { get; set; }
        public int IdEmpresa { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public int NumeroEmpleados { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateAreaRequest
    {
        public required int IdEmpresa { get; set; }
        public int IdSupervisorResponsable { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public int NumeroEmpleados { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateAreaRequest
    {
        public required int IdArea { get; set; }
        public required int IdEmpresa { get; set; }
        public int IdSupervisorResponsable { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public int NumeroEmpleados { get; set; }
        public bool Activo { get; set; }
    }

    public class AreaRequest
    {
        public int? IdEmpresa { get; set; }
        public string? Nombre { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
