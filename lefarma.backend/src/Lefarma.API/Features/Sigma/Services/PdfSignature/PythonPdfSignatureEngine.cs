using System.Diagnostics;
using Lefarma.API.Features.Sigma.Config;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public sealed class PythonPdfSignatureEngine
{
    private const string MarcadorSinPalabra = "ERROR_KEYWORD_NOT_FOUND";

    private readonly SigmaPdfSignatureOptions _options;
    private readonly SigmaOptions _sigmaOptions;
    private readonly string _cadenaAsokam;
    private readonly string _raizContenido;
    private readonly ILogger<PythonPdfSignatureEngine> _logger;

    public PythonPdfSignatureEngine(
        IOptions<SigmaPdfSignatureOptions> options,
        IOptions<SigmaOptions> sigmaOptions,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<PythonPdfSignatureEngine> logger)
    {
        _options = options.Value;
        _sigmaOptions = sigmaOptions.Value;
        _cadenaAsokam = configuration.GetConnectionString("AsokamConnection")
            ?? throw new InvalidOperationException("Falta la cadena de conexión 'AsokamConnection'.");
        _raizContenido = environment.ContentRootPath;
        _logger = logger;
    }

    public async Task<SigmaPdfSignatureResult> EjecutarAsync(
        Guid idDocumento,
        bool soloEscanear,
        CancellationToken ct = default)
    {
        var script = RutasRecursos.Resolver(_raizContenido, _options.ScriptPath);
        if (!File.Exists(script))
        {
            throw new FileNotFoundException(
                $"No se encontró el script de firma en '{script}'. Revisa Sigma:PdfSignature:ScriptPath.",
                script);
        }

        var imagen = RutasRecursos.Resolver(_raizContenido, _options.ImagePath);
        var almacen = RutasRecursos.Resolver(_raizContenido, _sigmaOptions.StoragePath);
        Directory.CreateDirectory(almacen);

        var conexion = new SqlConnectionStringBuilder(_cadenaAsokam);

        var argumentos = new List<string>
        {
            script,
            $"id_pdf={idDocumento:D}",
            $"scan_only={(soloEscanear ? 1 : 0)}",
            $"db_name={conexion.InitialCatalog}",
            $"image_path={imagen}",
            $"storage_dir={almacen}",
            $"search_text={_options.SearchText}"
        };

        var info = new ProcessStartInfo
        {
            FileName = _options.PythonExe,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        info.Environment["SIGMA_PDF_DB_SERVER"] = conexion.DataSource;
        info.Environment["SIGMA_PDF_DB_USER"] = conexion.UserID;
        info.Environment["SIGMA_PDF_DB_PASSWORD"] = conexion.Password;
        info.Environment["SIGMA_PDF_DB_NAME"] = conexion.InitialCatalog;
        info.Environment["SIGMA_PDF_STORAGE_DIR"] = almacen;

        foreach (var argumento in argumentos)
        {
            info.ArgumentList.Add(argumento);
        }

        using var proceso = new Process { StartInfo = info };
        if (!proceso.Start())
        {
            throw new InvalidOperationException("No se pudo iniciar el proceso de Python para firmar el PDF.");
        }

        var salida = proceso.StandardOutput.ReadToEndAsync(ct);
        var errores = proceso.StandardError.ReadToEndAsync(ct);

        using var tiempo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        tiempo.CancelAfter(TimeSpan.FromSeconds(Math.Max(10, _options.TimeoutSeconds)));

        try
        {
            await proceso.WaitForExitAsync(tiempo.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            try
            {
                proceso.Kill(entireProcessTree: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo terminar el proceso de firma del documento {IdDocumento}", idDocumento);
            }

            throw new TimeoutException(
                $"El script de firma excedió {_options.TimeoutSeconds} segundos para el documento {idDocumento}.");
        }

        var textoSalida = await salida;
        var textoErrores = await errores;

        if (proceso.ExitCode != 0)
        {
            _logger.LogError(
                "El script de firma falló para {IdDocumento} (código {Codigo}): {Errores}",
                idDocumento,
                proceso.ExitCode,
                textoErrores);
            throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(textoErrores)
                    ? $"El script de firma terminó con código {proceso.ExitCode}."
                    : $"El script de firma terminó con código {proceso.ExitCode}: {textoErrores.Trim()}");
        }

        _logger.LogInformation(
            "Script de firma ejecutado para {IdDocumento} (soloEscanear={SoloEscanear}): {Salida}",
            idDocumento,
            soloEscanear,
            textoSalida.Trim());

        return new SigmaPdfSignatureResult(textoSalida.Contains(MarcadorSinPalabra, StringComparison.Ordinal), textoSalida);
    }
}
