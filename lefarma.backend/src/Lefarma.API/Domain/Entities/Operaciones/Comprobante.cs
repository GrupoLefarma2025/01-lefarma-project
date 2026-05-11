using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Entities.Operaciones;

public class Comprobante
{
    public int IdComprobante { get; set; }
    public int IdEmpresa { get; set; }
    public int IdUsuarioSubio { get; set; }
    public int? IdPasoWorkflow { get; set; }
    public int? IdMedioPago { get; set; }

    public string Categoria { get; set; } = "gasto";
    public string TipoComprobante { get; set; } = null!;

    public decimal Total { get; set; }

    public string? ReferenciaPago { get; set; }
    public DateTime? FechaPago { get; set; }
    public decimal? MontoPago { get; set; }

    public string? DatosAdicionales { get; set; }

    public byte Estado { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    public virtual MedioPago? MedioPago { get; set; }
    public virtual ICollection<ComprobantePartida> Asignaciones { get; set; } = [];
}
