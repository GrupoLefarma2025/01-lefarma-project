using Lefarma.API.Features.Sigma.Config;
using Lefarma.API.Features.Sigma.Services.PdfSignature;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma;

/// <summary>Resultado de ejecutar el motor de firma.</summary>
/// <param name="PalabraClaveAusente">El PDF no contenía el texto que se reemplaza por la firma.</param>
/// <param name="Salida">Detalle del resultado (se registra para diagnóstico).</param>
public sealed record SigmaPdfSignatureResult(bool PalabraClaveAusente, string Salida);

/// <summary>
/// Fachada del firmado de PDFs. Elige el motor según <c>Sigma:PdfSignature:Motor</c>
/// (<c>csharp</c> por defecto, <c>python</c> para volver al script original) y aplica
/// el tiempo máximo configurado.
/// </summary>
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

    /// <summary>
    /// Procesa un documento de <c>app.Documentos</c>. Con <paramref name="soloEscanear"/>
    /// sólo comprueba que exista el texto de firma; sin él estampa la firma y guarda el
    /// binario autorizado.
    /// </summary>
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

            // El motor nativo hace trabajo pesado de CPU: se saca del hilo de la petición.
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
