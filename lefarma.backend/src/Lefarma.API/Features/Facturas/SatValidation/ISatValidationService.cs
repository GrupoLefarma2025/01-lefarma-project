namespace Lefarma.API.Features.Facturas.SatValidation;

public interface ISatValidationService
{
    Task<SatValidacionResult> ValidarAsync(
        string uuid,
        string rfcEmisor,
        string rfcReceptor,
        decimal total,
        CancellationToken ct = default);
}
