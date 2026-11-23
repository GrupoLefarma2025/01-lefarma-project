using System.Globalization;
using Lefarma.API.Features.Sigma.Config;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public sealed class CSharpPdfSignatureEngine
{
    private readonly IPdfDocumentStore _store;
    private readonly RasterStampRenderer _raster;
    private readonly VectorStampRenderer _vector;
    private readonly SigmaPdfSignatureOptions _options;
    private readonly string _raizContenido;
    private readonly ILogger<CSharpPdfSignatureEngine> _logger;

    public CSharpPdfSignatureEngine(
        IPdfDocumentStore store,
        RasterStampRenderer raster,
        VectorStampRenderer vector,
        IOptions<SigmaPdfSignatureOptions> options,
        IHostEnvironment environment,
        ILogger<CSharpPdfSignatureEngine> logger)
    {
        _store = store;
        _raster = raster;
        _vector = vector;
        _options = options.Value;
        _raizContenido = environment.ContentRootPath;
        _logger = logger;
    }

    public async Task<SigmaPdfSignatureResult> EjecutarAsync(
        Guid idDocumento,
        bool soloEscanear,
        CancellationToken ct = default)
    {
        var rutaImagen = RutasRecursos.Resolver(_raizContenido, _options.ImagePath);
        if (!soloEscanear && !File.Exists(rutaImagen))
        {
            throw new FileNotFoundException(
                $"No se encontró la imagen de la firma en '{rutaImagen}'. Revisa Sigma:PdfSignature:ImagePath.",
                rutaImagen);
        }

        var documento = await _store.ObtenerAsync(idDocumento, ct)
            ?? throw new InvalidOperationException($"No se encontró el documento {idDocumento:D} en app.Documentos.");
        var pdf = documento.Pdf
            ?? throw new InvalidOperationException($"El documento {idDocumento:D} no tiene PDF en app.Documentos.");

        await _store.GuardarCopiaAsync(idDocumento, string.Empty, pdf, ct);

        var coincidencias = soloEscanear
            ? PdfTextLocator.BuscarEnPrimeraPagina(pdf, _options.SearchText)
            : PdfTextLocator.Buscar(pdf, _options.SearchText);

        if (coincidencias.Count == 0)
        {
            if (soloEscanear)
            {
                await _store.EliminarAsync(idDocumento, ct);
            }
            else
            {
                await _store.DesactivarAsync(idDocumento, ct);
            }

            _logger.LogInformation(
                "El documento {IdDocumento} no contiene '{PalabraClave}' (soloEscanear={SoloEscanear}).",
                idDocumento,
                _options.SearchText,
                soloEscanear);

            return new SigmaPdfSignatureResult(true, PdfSignatureMessages.MarcadorSinPalabra);
        }

        if (soloEscanear)
        {
            return new SigmaPdfSignatureResult(false, PdfSignatureMessages.PalabraEncontrada);
        }

        var ajustes = new PdfSignatureSettings();
        var fecha = documento.FechaAutorizacion ?? DateTime.Now;
        var lineas = new[]
        {
            $"Id: {idDocumento:D}",
            $"Fecha: {fecha.ToString("dd/MM/yyyy HH:mm:ss", CultureInfo.InvariantCulture)}"
        };

        var imagen = await File.ReadAllBytesAsync(rutaImagen, ct);
        var renderer = ajustes.Aplanar ? (IPdfStampRenderer)_raster : _vector;
        var estampado = renderer.Estampar(pdf, imagen, coincidencias, lineas, ajustes, ct);
        var autorizado = PdfProtector.Proteger(estampado, ajustes);

        await _store.GuardarCopiaAsync(idDocumento, "_autorizado", autorizado, ct);
        await _store.GuardarAutorizadoAsync(idDocumento, autorizado, ct);

        _logger.LogInformation(
            "Documento {IdDocumento} firmado (motor C#): {Firmas} coincidencias, {Bytes} bytes.",
            idDocumento,
            coincidencias.Count,
            autorizado.Length);

        return new SigmaPdfSignatureResult(false, PdfSignatureMessages.Exito);
    }
}
