namespace Lefarma.API.Features.Facturas.SatValidation;

public interface ISatValidationService
{
    /// <summary>
    /// Consulta el estado de un CFDI en el servicio web del SAT.
    /// </summary>
    Task<SatValidacionResult> ValidarAsync(
        string uuid,
        string rfcEmisor,
        string rfcReceptor,
        decimal total,
        CancellationToken ct = default);
}
