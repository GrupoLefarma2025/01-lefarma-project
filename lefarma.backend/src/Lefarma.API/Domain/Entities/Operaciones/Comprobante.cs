namespace Lefarma.API.Domain.Entities.Operaciones;

public class Comprobante
{
    public int IdComprobante { get; set; }

    // Referencias
    public int IdEmpresa { get; set; }
    public int IdUsuarioSubio { get; set; }
    public int? IdPasoWorkflow { get; set; }

    // 'gasto' = factura/ticket/nota | 'pago' = transferencia/cheque/SPEI
    public string Categoria { get; set; } = "gasto";

    // Tipo: 'cfdi', 'ticket', 'nota', 'recibo', 'manual'
    public string TipoComprobante { get; set; } = null!;
    public bool EsCfdi { get; set; }

    // Datos CFDI (solo cuando EsCfdi = true)
    public string? UuidCfdi { get; set; }
    public string? VersionCfdi { get; set; }
    public string? Serie { get; set; }
    public string? FolioCfdi { get; set; }
    public DateTime? FechaEmision { get; set; }
    public string? RfcEmisor { get; set; }
    public string? NombreEmisor { get; set; }
    public string? RfcReceptor { get; set; }
    public string? NombreReceptor { get; set; }
    public string? UsoCfdi { get; set; }
    public string? MetodoPago { get; set; }
    public string? FormaPagoCfdi { get; set; }
    public string? Moneda { get; set; } = "MXN";
    public decimal? TipoCambio { get; set; } = 1m;

    // Totales (CFDI o capturados manualmente para comprobantes simples)
    public decimal Subtotal { get; set; }
    public decimal Descuento { get; set; }
    public decimal TotalIva { get; set; }
    public decimal TotalRetenciones { get; set; }
    public decimal Total { get; set; }

    // Campos exclusivos de categoria='pago'
    public string? ReferenciaPago { get; set; }  // número de transferencia, cheque, etc.
    public DateTime? FechaPago { get; set; }
    public decimal? MontoPago { get; set; }

    // XML raw almacenado para parseo y auditoría (solo CFDI)
    // Los archivos físicos van en archivos.Archivos con EntidadTipo='Comprobante'
    public string? XmlOriginal { get; set; }

    // Estado: 0=Pendiente asignación, 1=Parcial, 2=Aplicado, 3=Rechazado
    public byte Estado { get; set; }

    // Auditoría
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    // Navigation
    public virtual ICollection<ComprobanteConcepto> Conceptos { get; set; } = [];
    public virtual ICollection<ComprobantePartida> Asignaciones { get; set; } = [];
}
