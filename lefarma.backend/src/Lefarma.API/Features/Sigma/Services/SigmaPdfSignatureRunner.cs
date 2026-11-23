using Lefarma.API.Features.Sigma.Config;
using Lefarma.API.Features.Sigma.Services.PdfSignature;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma;

public sealed record SigmaPdfSignatureResult(bool PalabraClaveAusente, string Salida);

public sealed class SigmaPdfSignatureRunner
{
    private readonly SigmaPdfSignatureOptions _options;
    private readonly CSharpPdfSignatureEngine _csharp;
    private readonly PythonPdfSignatureEngine _python;
    private readonly ILogger<SigmaPdfSignatureRunner> _logger;

    public SigmaPdfSignatureRunner(
        IOptions<SigmaPdfSignatureOptions> options,
        CSharpPdfSignatureEngine csharp,
        PythonPdfSignatureEngine python,
        ILogger<SigmaPdfSignatureRunner> logger)
    {
        _options = options.Value;
        _csharp = csharp;
        _python = python;
        _logger = logger;
    }

    public async Task<SigmaPdfSignatureResult> EjecutarAsync(
        Guid idDocumento,
        bool soloEscanear,
        CancellationToken ct = default)
    {
        var usarPython = string.Equals(_options.Motor, "python", StringComparison.OrdinalIgnoreCase);

        using var tiempo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        tiempo.CancelAfter(TimeSpan.FromSeconds(Math.Max(10, _options.TimeoutSeconds)));

        try
        {
            if (usarPython)
            {
                return await _python.EjecutarAsync(idDocumento, soloEscanear, tiempo.Token);
            }

            return await Task.Run(
                () => _csharp.EjecutarAsync(idDocumento, soloEscanear, tiempo.Token),
                tiempo.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning(
                "El firmado del documento {IdDocumento} excedió {Segundos} segundos.",
                idDocumento,
                _options.TimeoutSeconds);

            throw new TimeoutException(
                $"El firmado excedió {_options.TimeoutSeconds} segundos para el documento {idDocumento}.");
        }
    }
}
