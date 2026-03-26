using System.Text.Json;
using ErrorOr;
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Archivos.Services;

public class ArchivoService : IArchivoService
{
    private readonly IArchivoRepository _repository;
    private readonly ArchivosSettings _settings;
    private readonly ILogger<ArchivoService> _logger;

    public ArchivoService(
        IArchivoRepository repository,
        IOptions<ArchivosSettings> settings,
        ILogger<ArchivoService> logger)
    {
        _repository = repository;
        _settings = settings.Value;
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
        // Validar extensión
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!_settings.ExtensionesPermitidas.Contains(extension))
            return Errors.Archivo.InvalidContentType;

        // Validar tamaño
        if (fileStream.Length > _settings.TamanoMaximoMB * 1024 * 1024)
            return Errors.Archivo.FileTooLarge;

        // Generar nombre físico único
        var nombreFisico = $"{Guid.NewGuid()}{extension}";
        
        // Crear directorio si no existe
        var directorioCompleto = Path.Combine(_settings.BasePath, request.Carpeta);
        Directory.CreateDirectory(directorioCompleto);

        // Guardar archivo
        var rutaCompleta = Path.Combine(directorioCompleto, nombreFisico);
        using (var fs = new FileStream(rutaCompleta, FileMode.Create))
        {
            await fileStream.CopyToAsync(fs, cancellationToken);
        }

        // Crear entidad
        var archivo = new Archivo
        {
            EntidadTipo = request.EntidadTipo,
            EntidadId = request.EntidadId,
            Carpeta = request.Carpeta,
            NombreOriginal = fileName,
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
        // Obtener archivo anterior
        var archivoAnterior = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivoAnterior == null)
            return Errors.Archivo.NotFound;

        // Inactivar archivo anterior
        archivoAnterior.Activo = false;
        archivoAnterior.NombreFisico = $"{Path.GetFileNameWithoutExtension(archivoAnterior.NombreFisico)}_inactivo{archivoAnterior.Extension}";
        archivoAnterior.FechaEdicion = DateTime.UtcNow;
        await _repository.UpdateAsync(archivoAnterior, cancellationToken);

        // Renombrar archivo físico anterior
        var rutaAnterior = Path.Combine(_settings.BasePath, archivoAnterior.Carpeta, archivoAnterior.NombreFisico);
        var rutaAnteriorOriginal = Path.Combine(_settings.BasePath, archivoAnterior.Carpeta, 
            $"{Path.GetFileNameWithoutExtension(archivoAnterior.NombreFisico).Replace("_inactivo", "")}{archivoAnterior.Extension}");
        
        if (File.Exists(rutaAnteriorOriginal))
        {
            File.Move(rutaAnteriorOriginal, rutaAnterior, true);
        }

        // Subir nuevo archivo
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
            return Errors.Archivo.NotFound;

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

        return archivos.Select(MapToListItemResponse).ToList();
    }

    public async Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> DownloadAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return Errors.Archivo.NotFound;

        var ruta = Path.Combine(_settings.BasePath, archivo.Carpeta, archivo.NombreFisico);
        if (!File.Exists(ruta))
            return Errors.Archivo.NotFound;

        var stream = new FileStream(ruta, FileMode.Open, FileAccess.Read);
        return (stream, archivo.NombreOriginal, archivo.TipoMime);
    }

    public async Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> PreviewAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return Errors.Archivo.NotFound;

        var rutaOriginal = Path.Combine(_settings.BasePath, archivo.Carpeta, archivo.NombreFisico);
        if (!File.Exists(rutaOriginal))
            return Errors.Archivo.NotFound;

        // Devolver el archivo original directamente
        var stream = new FileStream(rutaOriginal, FileMode.Open, FileAccess.Read);
        return (stream, archivo.NombreOriginal, archivo.TipoMime);
    }

    public async Task<ErrorOr<bool>> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var archivo = await _repository.GetByIdAsync(id, cancellationToken);
        if (archivo == null)
            return Errors.Archivo.NotFound;

        // Renombrar archivo físico
        var rutaActual = Path.Combine(_settings.BasePath, archivo.Carpeta, archivo.NombreFisico);
        var nuevoNombre = $"{Path.GetFileNameWithoutExtension(archivo.NombreFisico)}_inactivo{archivo.Extension}";
        var rutaNueva = Path.Combine(_settings.BasePath, archivo.Carpeta, nuevoNombre);

        if (File.Exists(rutaActual))
        {
            File.Move(rutaActual, rutaNueva, true);
        }

        await _repository.DeleteAsync(id, cancellationToken);

        _logger.LogInformation("Archivo eliminado (soft delete): {Id}", id);

        return true;
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

    private static ArchivoListItemResponse MapToListItemResponse(Archivo archivo)
    {
        return new ArchivoListItemResponse(
            archivo.Id,
            archivo.NombreOriginal,
            archivo.Extension,
            archivo.TipoMime,
            archivo.TamanoBytes,
            archivo.FechaCreacion,
            archivo.Activo
        );
    }
}
