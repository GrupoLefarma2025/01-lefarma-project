namespace Lefarma.API.Features.Catalogos.TiposGasto.DTOs
{
    public class TipoGastoResponse
    {
        public int IdTipoGasto { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreNormalizado { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public bool RequiereComprobacionPago { get; set; }
        public bool RequiereComprobacionGasto { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateTipoGastoRequest
    {
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public bool RequiereComprobacionPago { get; set; } = true;
        public bool RequiereComprobacionGasto { get; set; } = true;
        public bool Activo { get; set; } = true;
    }

    public class UpdateTipoGastoRequest
    {
        public required int IdTipoGasto { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public bool RequiereComprobacionPago { get; set; }
        public bool RequiereComprobacionGasto { get; set; }
        public bool Activo { get; set; }
    }

    public class TipoGastoRequest
    {
        public string? Nombre { get; set; }
        public bool? RequiereComprobacionPago { get; set; }
        public bool? RequiereComprobacionGasto { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
