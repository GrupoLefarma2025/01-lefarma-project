using System.Data;
using Lefarma.API.Features.Sigma.Config;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>
/// Implementación real del almacén: Dapper contra la base legacy y copias de trabajo
/// en <c>Sigma:StoragePath</c>, con las mismas cuatro sentencias del script de Python.
/// </summary>
public sealed class PdfDocumentStore : IPdfDocumentStore
{
    private const string SqlObtener =
        "SELECT PDFBinario, FechaAutorizacion FROM app.Documentos WHERE Id = @Id";

    private const string SqlAutorizar =
        "UPDATE app.Documentos SET Estatus = 2, FechaAutorizacion = GETDATE(), PDFBinarioAutorizado = @Pdf WHERE Id = @Id";

    private const string SqlDesactivar =
        "UPDATE app.Documentos SET Activo = 0 WHERE Id = @Id";

    private const string SqlEliminar =
        "DELETE FROM app.Documentos WHERE Id = @Id";

    private readonly SigmaDb _db;
    private readonly string _almacen;
    private readonly ILogger<PdfDocumentStore> _logger;

    public PdfDocumentStore(
        SigmaDb db,
        IOptions<SigmaOptions> opciones,
        IHostEnvironment entorno,
        ILogger<PdfDocumentStore> logger)
    {
        _db = db;
        _logger = logger;

        var ruta = opciones.Value.StoragePath;
        _almacen = string.IsNullOrWhiteSpace(ruta)
            ? Path.Combine(entorno.ContentRootPath, "App_Data", "sigma-documentos")
            : Path.IsPathRooted(ruta)
                ? ruta
                : Path.Combine(entorno.ContentRootPath, ruta);
    }

    public async Task<DocumentoFirma?> ObtenerAsync(Guid idDocumento, CancellationToken ct)
    {
        var fila = await _db.QueryFirstOrDefaultAsync<FilaDocumento>(
            SqlObtener,
            new { Id = idDocumento },
            CommandType.Text,
            ct);

        return fila is null ? null : new DocumentoFirma(fila.PDFBinario, fila.FechaAutorizacion);
    }

    public Task GuardarCopiaAsync(Guid idDocumento, string sufijo, byte[] contenido, CancellationToken ct)
    {
        try
        {
            Directory.CreateDirectory(_almacen);

            var destino = Path.Combine(_almacen, $"{idDocumento:D}{sufijo}.pdf");
            var temporal = destino + ".tmp";
            File.WriteAllBytes(temporal, contenido);
            File.Move(temporal, destino, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Igual que el script, la copia es informativa: si falla, se avisa y se sigue.
            _logger.LogWarning(ex, "No se pudo guardar la copia {Sufijo} del documento {Id}.", sufijo, idDocumento);
        }

        return Task.CompletedTask;
    }

    public async Task GuardarAutorizadoAsync(Guid idDocumento, byte[] pdfAutorizado, CancellationToken ct)
    {
        var filas = await _db.ExecuteAsync(
            SqlAutorizar,
            new { Pdf = pdfAutorizado, Id = idDocumento },
            CommandType.Text,
            ct);

        if (filas == 0)
        {
            throw new InvalidOperationException(
                $"No se pudo actualizar el documento {idDocumento:D}; no existe en app.Documentos.");
        }
    }

    public Task DesactivarAsync(Guid idDocumento, CancellationToken ct) =>
        _db.ExecuteAsync(SqlDesactivar, new { Id = idDocumento }, CommandType.Text, ct);

    public Task EliminarAsync(Guid idDocumento, CancellationToken ct) =>
        _db.ExecuteAsync(SqlEliminar, new { Id = idDocumento }, CommandType.Text, ct);

    private sealed class FilaDocumento
    {
        public byte[]? PDFBinario { get; set; }

        public DateTime? FechaAutorizacion { get; set; }
    }
}
