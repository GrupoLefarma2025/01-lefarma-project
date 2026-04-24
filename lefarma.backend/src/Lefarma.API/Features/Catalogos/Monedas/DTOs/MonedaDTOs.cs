namespace Lefarma.API.Features.Catalogos.Monedas.DTOs;

public class MonedaResponse
{
    public int IdMoneda { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Simbolo { get; set; } = string.Empty;
    public string Locale { get; set; } = string.Empty;
    public decimal TipoCambio { get; set; }
    public bool EsDefault { get; set; }
    public bool Activo { get; set; }
}
