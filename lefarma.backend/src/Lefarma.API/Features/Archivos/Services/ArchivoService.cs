using System.Security.Cryptography;
using ErrorOr;
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Notifications;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Archivos.Services;
public class ArchivoService : IArchivoService
{
    private const string MotivoEliminacion = "Eliminacion";
    private const string MotivoReemplazo = "Reemplazo";

    private readonly IArchivoRepository _repository;
    private readonly ArchivosSettings _settings;
    private readonly AsokamDbContext _asokamDb;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ArchivoService> _logger;

    public ArchivoService(
        IArchivoRepository repository,
        IOptions<ArchivosSettings> settings,
        AsokamDbContext asokamDb,
        IServiceScopeFactory scopeFactory,
        ILogger<ArchivoService> logger)
    {
        _repository = repository;
        _settings = settings.Value;
        _asokamDb = asokamDb;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<ErrorOr<ArchivoResponse>> SubirAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        SubirArchivoRequest request,
        int? usuarioId = null,
        CancellationToken cancellationToken = default)
    {
        var nombreOriginal = new string(Path.GetFileName(fileName).Where(c => !char.IsControl(c)).ToArray()).Trim();

        var extension = Path.GetExtension(nombreOriginal).ToLowerInvariant();
        if (!_settings.ExtensionesPermitidas.Contains(extension))
            return CommonErrors.Validation("ContentType", "El tipo de archivo no está permitido");

        if (fileStream.Length > _settings.TamanoMaximoMB * 1024 * 1024)
            return CommonErrors.Validation("FileTooLarge", "El archivo excede el tamaño máximo permitido");

        var nombreFisico = $"{Guid.NewGuid()}{extension}";
        
        var directorioCompleto = Path.Combine(_settings.BasePath, request.Carpeta);
        Directory.CreateDirectory(directorioCompleto);

        var rutaCompleta = Path.Combine(directorioCompleto, nombreFisico);
        using (var fs = new FileStream(rutaCompleta, FileMode.Create))
        {
            await fileStream.CopyToAsync(fs, cancellationToken);
        }

        var archivo = new Archivo
        {
            EntidadTipo = request.EntidadTipo,
            EntidadId = request.EntidadId,
            Carpeta = request.Carpeta,
            NombreOriginal = nombreOriginal,
            NombreFisico = nombreFisico,
            Extension = extension,
            TipoMime = contentType,
            TamanoBytes = fileStream.Length,
            Metadata = request.Metadata,
            FechaCreacion = DateTime.UtcNow,
            UsuarioId = usuarioId,
            Activo = true
        };

        var creado = await _repository.CreateAsync(archivo, cancellationToken);

        _logger.LogInformation("Archivo subido: {Id} - {NombreOriginal}", creado.Id, creado.NombreOriginal);

        return MapToResponse(creado);
    }

    public async Task<ErrorOr<ArchivoResponse>> ReemplazarAsync(
        int id,
        Stream fileStream,
        string fileName,
        string contentType,
        string? metadata = null,
        int? usuarioId = null,
        CancellationToken cancellationToken = default)
    {
        var archivoAnterior = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivoAnterior == null)
            return CommonErrors.NotFound("Archivo");

        archivoAnterior.FechaEdicion = DateTime.UtcNow;
        var eliminacion = MoverAHistorico(archivoAnterior, MotivoReemplazo, usuarioId);
        await _repository.DeleteAsync(archivoAnterior.Id, eliminacion, cancellationToken);

        var nuevoRequest = new SubirArchivoRequest
        {
            EntidadTipo = archivoAnterior.EntidadTipo,
            EntidadId = archivoAnterior.EntidadId,
            Carpeta = archivoAnterior.Carpeta,
            Metadata = metadata ?? archivoAnterior.Metadata
        };

        return await SubirAsync(fileStream, fileName, contentType, nuevoRequest, usuarioId, cancellationToken);
    }

    public async Task<ErrorOr<ArchivoResponse>> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return CommonErrors.NotFound("Archivo");

        return MapToResponse(archivo);
    }

    public async Task<ErrorOr<IEnumerable<ArchivoListItemResponse>>> GetAllAsync(
        ListarArchivosQuery query,
        CancellationToken cancellationToken = default)
    {
        var archivos = await _repository.GetAllAsync(
            query.EntidadTipo,
            query.EntidadId,
            query.SoloActivos,
            cancellationToken);

        var archivosList = archivos.ToList();

        var idsInactivos = archivosList.Where(a => !a.Activo).Select(a => a.Id).ToList();
        var eliminaciones = idsInactivos.Count > 0
            ? (await _repository.GetEliminacionesAsync(idsInactivos, cancellationToken))
                .GroupBy(e => e.IdArchivo)
                .ToDictionary(g => g.Key, g => g.First())
            : new Dictionary<int, ArchivoEliminado>();

        var userIds = archivosList
            .Where(a => a.UsuarioId.HasValue)
            .Select(a => a.UsuarioId!.Value)
            .Concat(eliminaciones.Values
                .Where(e => e.IdUsuarioElimina.HasValue)
                .Select(e => e.IdUsuarioElimina!.Value))
            .Distinct()
            .ToList();
        var usuarios = userIds.Count > 0
            ? await _asokamDb.Usuarios
                .Where(u => userIds.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}")
            : new Dictionary<int, string>();

        return archivosList.Select(a =>
        {
            string? nombreSubio = null;
            if (a.UsuarioId.HasValue)
                usuarios.TryGetValue(a.UsuarioId.Value, out nombreSubio);

            eliminaciones.TryGetValue(a.Id, out var eliminacion);
            string? nombreElimino = null;
            if (eliminacion?.IdUsuarioElimina is int idElimino)
                usuarios.TryGetValue(idElimino, out nombreElimino);

            return MapToListItemResponse(a, nombreSubio, eliminacion, nombreElimino);
        }).ToList();
    }

    public async Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> DownloadAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return CommonErrors.NotFound("Archivo");

        var ruta = await ResolverRutaAsync(archivo, cancellationToken);
        if (!File.Exists(ruta))
            return CommonErrors.NotFound("Archivo");

        var stream = new FileStream(ruta, FileMode.Open, FileAccess.Read);
        return (stream, archivo.NombreOriginal, archivo.TipoMime);
    }

    public async Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> PreviewAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return CommonErrors.NotFound("Archivo");

        var rutaOriginal = await ResolverRutaAsync(archivo, cancellationToken);
        if (!File.Exists(rutaOriginal))
            return CommonErrors.NotFound("Archivo");

        var stream = new FileStream(rutaOriginal, FileMode.Open, FileAccess.Read);
        return (stream, archivo.NombreOriginal, archivo.TipoMime);
    }

    public async Task<ErrorOr<bool>> DeleteAsync(
        int id,
        int? usuarioId = null,
        CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return CommonErrors.NotFound("Archivo");

        var evento = new ArchivoEliminadoEvento(
            archivo.Id,
            archivo.EntidadTipo,
            archivo.EntidadId,
            archivo.Carpeta,
            archivo.NombreOriginal,
            archivo.Extension,
            archivo.TamanoBytes,
            archivo.Metadata,
            archivo.FechaCreacion,
            archivo.UsuarioId,
            usuarioId,
            DateTime.Now);

        var eliminacion = MoverAHistorico(archivo, MotivoEliminacion, usuarioId);

        await _repository.DeleteAsync(id, eliminacion, cancellationToken);

        _logger.LogInformation(
            "Archivo eliminado (soft delete): {Id} por usuario {UsuarioId}; histórico: {Ruta}",
            id, usuarioId, eliminacion.RutaHistorica ?? "sin binario");

        ArchivoEliminacionDispatch.Enviar(_scopeFactory, evento);

        return true;
    }

    public async Task<int> GetArchivosCountAsync(
        string entidadTipo, int entidadId, string carpeta,
        bool soloActivos = true, CancellationToken ct = default)
        => await _repository.GetCountAsync(entidadTipo, entidadId, carpeta, soloActivos, ct);

    private ArchivoEliminado MoverAHistorico(Archivo archivo, string motivo, int? usuarioId)
    {
        var fechaBaja = DateTime.UtcNow;
        var rutaActual = Path.Combine(_settings.BasePath, archivo.Carpeta, archivo.NombreFisico);
        string? rutaRelativa = null;
        string? hash = null;

        if (File.Exists(rutaActual))
        {
            hash = CalcularHashSha256(rutaActual);

            var carpetaHistorica = Path.Combine("eliminados", fechaBaja.ToString("yyyy"), fechaBaja.ToString("MM"));
            var carpetaDestino = Path.Combine(_settings.PrivatePath, carpetaHistorica);
            Directory.CreateDirectory(carpetaDestino);

            var nombreDestino = $"{archivo.Id}-{Guid.NewGuid():N}{archivo.Extension}";
            File.Move(rutaActual, Path.Combine(carpetaDestino, nombreDestino));

            rutaRelativa = $"{carpetaHistorica.Replace('\\', '/')}/{nombreDestino}";
        }
        else
        {
            _logger.LogWarning(
                "El binario del archivo {Id} no existe en {Ruta}; se registra la baja sin histórico",
                archivo.Id, rutaActual);
        }

        return new ArchivoEliminado
        {
            IdArchivo = archivo.Id,
            EntidadTipo = archivo.EntidadTipo,
            EntidadId = archivo.EntidadId,
            Carpeta = archivo.Carpeta,
            NombreOriginal = archivo.NombreOriginal,
            NombreFisico = archivo.NombreFisico,
            Extension = archivo.Extension,
            TipoMime = archivo.TipoMime,
            TamanoBytes = archivo.TamanoBytes,
            Metadata = archivo.Metadata,
            HashSha256 = hash,
            RutaHistorica = rutaRelativa,
            IdUsuarioSubio = archivo.UsuarioId,
            FechaSubida = archivo.FechaCreacion,
            IdUsuarioElimina = usuarioId,
            FechaEliminacion = fechaBaja,
            Motivo = motivo
        };
    }

    private static string? CalcularHashSha256(string ruta)
    {
        try
        {
            using var stream = File.OpenRead(ruta);
            return Convert.ToHexString(SHA256.HashData(stream));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private async Task<string> ResolverRutaAsync(Archivo archivo, CancellationToken cancellationToken)
    {
        if (!archivo.Activo)
        {
            var eliminacion = await _repository.GetEliminacionAsync(archivo.Id, cancellationToken);
            if (!string.IsNullOrWhiteSpace(eliminacion?.RutaHistorica))
            {
                var rutaHistorica = eliminacion.RutaHistorica.Replace('/', Path.DirectorySeparatorChar);
                return Path.Combine(_settings.PrivatePath, rutaHistorica);
            }
        }

        return Path.Combine(_settings.BasePath, archivo.Carpeta, archivo.NombreFisico);
    }

    private static ArchivoResponse MapToResponse(Archivo archivo)
    {
        return new ArchivoResponse(
            archivo.Id,
            archivo.EntidadTipo,
            archivo.EntidadId,
            archivo.Carpeta,
            archivo.NombreOriginal,
            archivo.NombreFisico,
            archivo.Extension,
            archivo.TipoMime,
            archivo.TamanoBytes,
            archivo.Metadata,
            archivo.FechaCreacion,
            archivo.FechaEdicion,
            archivo.UsuarioId,
            archivo.Activo
        );
    }

    private static ArchivoListItemResponse MapToListItemResponse(
        Archivo archivo,
        string? usuarioSubioNombre = null,
        ArchivoEliminado? eliminacion = null,
        string? usuarioEliminoNombre = null)
    {
        return new ArchivoListItemResponse(
            archivo.Id,
            archivo.NombreOriginal,
            archivo.Extension,
            archivo.TipoMime,
            archivo.TamanoBytes,
            archivo.Metadata,
            archivo.FechaCreacion,
            archivo.UsuarioId,
            usuarioSubioNombre,
            archivo.Activo,
            eliminacion?.FechaEliminacion,
            usuarioEliminoNombre,
            eliminacion?.Motivo
        );
    }
}
