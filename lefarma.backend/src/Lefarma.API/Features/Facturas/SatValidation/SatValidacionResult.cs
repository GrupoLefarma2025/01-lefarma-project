namespace Lefarma.API.Features.Facturas.SatValidation;

/// <summary>
/// Resultado de la consulta al servicio del SAT para verificar un CFDI.
/// </summary>
public record SatValidacionResult(
    bool    Contactado,           // true si el SAT respondió (aunque sea "No Encontrado")
    string? Estado,               // "Vigente" | "Cancelado" | "No Encontrado"
    string? CodigoEstatus,        // "S - Comprobante obtenido..." | "N - ..."
    string? EstatusCancelacion,   // null si Vigente; "Cancelado sin aceptación", "En proceso", etc.
    bool    PermitirAvanzar = false  // true cuando la validación está deshabilitada por configuración
)
{
    public bool EsVigente => Contactado && Estado == "Vigente";
}
