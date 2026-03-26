# Sistema de Gestión de Archivos - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema genérico de gestión de archivos con upload, preview, download y versionado para múltiples módulos.

**Architecture:** Feature-based architecture siguiendo patrones existentes del proyecto. Backend con Entity, Repository, Service, Controller. Frontend con React components canvas-based para visualización.

**Tech Stack:** .NET 10, EF Core, LibreOffice (conversión), React 19, pdfjs-dist

**Spec:** `lefarma.docs/specs/2026-03-25-sistema-gestion-archivos-design.md`

---

## File Structure

### Backend

| Archivo | Responsabilidad |
|---------|-----------------|
| `Domain/Entities/Archivos/Archivo.cs` | Entity con todos los campos |
| `Domain/Interfaces/IArchivoRepository.cs` | Interface del repositorio |
| `Infrastructure/Data/Configurations/Archivos/ArchivoConfiguration.cs` | EF Core mapping |
| `Infrastructure/Data/Repositories/ArchivoRepository.cs` | Implementación repositorio |
| `Features/Archivos/Controllers/ArchivosController.cs` | Endpoints HTTP |
| `Features/Archivos/Services/IArchivoService.cs` | Interface del servicio |
| `Features/Archivos/Services/ArchivoService.cs` | Lógica de negocio |
| `Features/Archivos/DTOs/ArchivoResponse.cs` | Response completo |
| `Features/Archivos/DTOs/ArchivoListItemResponse.cs` | Response para listado |
| `Features/Archivos/DTOs/SubirArchivoRequest.cs` | Request upload |
| `Features/Archivos/DTOs/ListarArchivosQuery.cs` | Query params listado |
| `Features/Archivos/Conversores/OfficeToPdfConverter.cs` | LibreOffice headless |
| `Shared/Errors/ArchivoErrors.cs` | Errores del dominio |
| `Infrastructure/Data/ApplicationDbContext.cs` | Agregar DbSet |
| `Program.cs` | Registrar servicios |
| `appsettings.json` | Configuración |

### Frontend

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/types/archivo.types.ts` | TypeScript interfaces |
| `src/services/archivoService.ts` | API client |
| `src/components/archivos/FileUploader.tsx` | Modal de upload |
| `src/components/archivos/FileViewer.tsx` | Modal de visualización |

---

## Phase 1: Backend - Domain & Infrastructure

### Task 1: Entity Archivo

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Entities/Archivos/Archivo.cs`

- [ ] **Step 1: Create Archivo entity**

```csharp
namespace Lefarma.API.Domain.Entities.Archivos;

public class Archivo
{
    public int Id { get; set; }
    public string EntidadTipo { get; set; } = string.Empty;
    public int EntidadId { get; set; }
    public string Carpeta { get; set; } = string.Empty;
    public string NombreOriginal { get; set; } = string.Empty;
    public string NombreFisico { get; set; } = string.Empty;
    public string Extension { get; set; } = string.Empty;
    public string TipoMime { get; set; } = string.Empty;
    public long TamanoBytes { get; set; }
    public string? Metadata { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaEdicion { get; set; }
    public int? UsuarioId { get; set; }
    public bool Activo { get; set; } = true;
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Domain/Entities/Archivos/Archivo.cs
git commit -m "feat(archivos): add Archivo entity"
```

---

### Task 2: Repository Interface

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/IArchivoRepository.cs`

- [ ] **Step 1: Create IArchivoRepository interface**

```csharp
using Lefarma.API.Domain.Entities.Archivos;

namespace Lefarma.API.Domain.Interfaces;

public interface IArchivoRepository
{
    Task<Archivo> CreateAsync(Archivo archivo, CancellationToken cancellationToken = default);
    Task<Archivo?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Archivo>> GetAllAsync(
        string? entidadTipo = null,
        int? entidadId = null,
        bool soloActivos = true,
        CancellationToken cancellationToken = default);
    Task<Archivo?> GetByNombreFisicoAsync(string nombreFisico, CancellationToken cancellationToken = default);
    Task UpdateAsync(Archivo archivo, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Domain/Interfaces/IArchivoRepository.cs
git commit -m "feat(archivos): add IArchivoRepository interface"
```

---

### Task 3: EF Core Configuration

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Archivos/ArchivoConfiguration.cs`

- [ ] **Step 1: Create ArchivoConfiguration**

```csharp
using Lefarma.API.Domain.Entities.Archivos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Archivos;

public class ArchivoConfiguration : IEntityTypeConfiguration<Archivo>
{
    public void Configure(EntityTypeBuilder<Archivo> builder)
    {
        builder.ToTable("Archivos", "archivos");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.EntidadTipo)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.EntidadId)
            .IsRequired();

        builder.Property(a => a.Carpeta)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(a => a.NombreOriginal)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(a => a.NombreFisico)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(a => a.Extension)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(a => a.TipoMime)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.TamanoBytes)
            .IsRequired();

        builder.Property(a => a.Metadata)
            .HasColumnType("nvarchar(max)");

        builder.Property(a => a.FechaCreacion)
            .IsRequired();

        builder.Property(a => a.FechaEdicion);

        builder.Property(a => a.UsuarioId);

        builder.Property(a => a.Activo)
            .IsRequired()
            .HasDefaultValue(true);

        builder.HasIndex(a => new { a.EntidadTipo, a.EntidadId })
            .HasDatabaseName("IX_Archivos_Entidad");

        builder.HasIndex(a => a.Carpeta)
            .HasDatabaseName("IX_Archivos_Carpeta");
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Archivos/ArchivoConfiguration.cs
git commit -m "feat(archivos): add Archivo EF Core configuration"
```

---

### Task 4: Repository Implementation

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/ArchivoRepository.cs`

- [ ] **Step 1: Create ArchivoRepository**

```csharp
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;

public class ArchivoRepository : IArchivoRepository
{
    private readonly ApplicationDbContext _context;

    public ArchivoRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Archivo> CreateAsync(Archivo archivo, CancellationToken cancellationToken = default)
    {
        _context.Archivos.Add(archivo);
        await _context.SaveChangesAsync(cancellationToken);
        return archivo;
    }

    public async Task<Archivo?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Archivos
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public async Task<IEnumerable<Archivo>> GetAllAsync(
        string? entidadTipo = null,
        int? entidadId = null,
        bool soloActivos = true,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Archivos.AsQueryable();

        if (!string.IsNullOrEmpty(entidadTipo))
            query = query.Where(a => a.EntidadTipo == entidadTipo);

        if (entidadId.HasValue)
            query = query.Where(a => a.EntidadId == entidadId.Value);

        if (soloActivos)
            query = query.Where(a => a.Activo);

        return await query
            .OrderByDescending(a => a.FechaCreacion)
            .ToListAsync(cancellationToken);
    }

    public async Task<Archivo?> GetByNombreFisicoAsync(string nombreFisico, CancellationToken cancellationToken = default)
    {
        return await _context.Archivos
            .FirstOrDefaultAsync(a => a.NombreFisico == nombreFisico, cancellationToken);
    }

    public async Task UpdateAsync(Archivo archivo, CancellationToken cancellationToken = default)
    {
        _context.Archivos.Update(archivo);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var archivo = await GetByIdAsync(id, cancellationToken);
        if (archivo != null)
        {
            archivo.Activo = false;
            archivo.NombreFisico = $"{Path.GetFileNameWithoutExtension(archivo.NombreFisico)}_inactivo{archivo.Extension}";
            await UpdateAsync(archivo, cancellationToken);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/ArchivoRepository.cs
git commit -m "feat(archivos): add ArchivoRepository implementation"
```

---

### Task 5: Domain Errors

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Shared/Errors/ArchivoErrors.cs`

- [ ] **Step 1: Create ArchivoErrors**

```csharp
using ErrorOr;

namespace Lefarma.API.Shared.Errors;

public static partial class Errors
{
    public static class Archivo
    {
        public static Error NotFound => Error.NotFound(
            "Archivo.NotFound",
            "El archivo no fue encontrado");

        public static Error InvalidContentType => Error.Validation(
            "Archivo.InvalidContentType",
            "El tipo de archivo no está permitido");

        public static Error FileTooLarge => Error.Validation(
            "Archivo.FileTooLarge",
            "El archivo excede el tamaño máximo permitido");

        public static Error ConversionFailed => Error.Failure(
            "Archivo.ConversionFailed",
            "No se pudo convertir el archivo a PDF");

        public static Error PreviewNotSupported => Error.Failure(
            "Archivo.PreviewNotSupported",
            "La previsualización no está disponible para este tipo de archivo");
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Shared/Errors/ArchivoErrors.cs
git commit -m "feat(archivos): add Archivo domain errors"
```

---

### Task 6: Update ApplicationDbContext

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`

- [ ] **Step 1: Add DbSet and configuration**

Buscar la línea donde están los otros DbSet y agregar:
```csharp
public DbSet<Domain.Entities.Archivos.Archivo> Archivos { get; set; } = null!;
```

Buscar donde se aplican las configuraciones (OnModelCreating) y agregar:
```csharp
modelBuilder.ApplyConfiguration(new Configurations.Archivos.ArchivoConfiguration());
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs
git commit -m "feat(archivos): add Archivos DbSet to DbContext"
```

---

## Phase 2: Backend - Feature Module

### Task 7: DTOs

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/DTOs/ArchivoResponse.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/DTOs/ArchivoListItemResponse.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/DTOs/SubirArchivoRequest.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/DTOs/ListarArchivosQuery.cs`

- [ ] **Step 1: Create ArchivoResponse**

```csharp
namespace Lefarma.API.Features.Archivos.DTOs;

public record ArchivoResponse(
    int Id,
    string EntidadTipo,
    int EntidadId,
    string Carpeta,
    string NombreOriginal,
    string NombreFisico,
    string Extension,
    string TipoMime,
    long TamanoBytes,
    string? Metadata,
    DateTime FechaCreacion,
    DateTime? FechaEdicion,
    int? UsuarioId,
    bool Activo
);
```

- [ ] **Step 2: Create ArchivoListItemResponse**

```csharp
namespace Lefarma.API.Features.Archivos.DTOs;

public record ArchivoListItemResponse(
    int Id,
    string NombreOriginal,
    string Extension,
    string TipoMime,
    long TamanoBytes,
    DateTime FechaCreacion,
    bool Activo
);
```

- [ ] **Step 3: Create SubirArchivoRequest**

```csharp
using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Archivos.DTOs;

public record SubirArchivoRequest
{
    [Required]
    public string EntidadTipo { get; init; } = string.Empty;

    [Required]
    public int EntidadId { get; init; }

    [Required]
    public string Carpeta { get; init; } = string.Empty;

    public string? Metadata { get; init; }
}
```

- [ ] **Step 4: Create ListarArchivosQuery**

```csharp
namespace Lefarma.API.Features.Archivos.DTOs;

public record ListarArchivosQuery
{
    public string? EntidadTipo { get; init; }
    public int? EntidadId { get; init; }
    public bool SoloActivos { get; init; } = true;
}
```

- [ ] **Step 5: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Archivos/DTOs/
git commit -m "feat(archivos): add DTOs for Archivos feature"
```

---

### Task 8: Settings Configuration

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/Settings/ArchivosSettings.cs`
- Modify: `lefarma.backend/src/Lefarma.API/appsettings.json`

- [ ] **Step 1: Create ArchivosSettings**

```csharp
namespace Lefarma.API.Features.Archivos.Settings;

public class ArchivosSettings
{
    public string BasePath { get; set; } = "wwwroot/media/archivos";
    public string LibreOfficePath { get; set; } = "/usr/bin/soffice";
    public int TamanoMaximoMB { get; set; } = 10;
    public List<string> ExtensionesPermitidas { get; set; } = new()
    {
        ".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"
    };
}
```

- [ ] **Step 2: Add to appsettings.json**

Agregar dentro del objeto principal:
```json
"ArchivosSettings": {
  "BasePath": "wwwroot/media/archivos",
  "LibreOfficePath": "/usr/bin/soffice",
  "TamanoMaximoMB": 10,
  "ExtensionesPermitidas": [".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"]
}
```

- [ ] **Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Archivos/Settings/ArchivosSettings.cs
git add lefarma.backend/src/Lefarma.API/appsettings.json
git commit -m "feat(archivos): add ArchivosSettings configuration"
```

---

### Task 9: Office to PDF Converter

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/Conversores/OfficeToPdfConverter.cs`

- [ ] **Step 1: Create OfficeToPdfConverter**

```csharp
using ErrorOr;
using Lefarma.API.Features.Archivos.Settings;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Archivos.Conversores;

public interface IOfficeToPdfConverter
{
    bool CanConvert(string extension);
    Task<ErrorOr<string>> ConvertToPdfAsync(string inputPath, string outputDirectory, CancellationToken cancellationToken = default);
}

public class OfficeToPdfConverter : IOfficeToPdfConverter
{
    private readonly ArchivosSettings _settings;
    private readonly ILogger<OfficeToPdfConverter> _logger;

    private static readonly string[] OfficeExtensions = { ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt" };

    public OfficeToPdfConverter(
        IOptions<ArchivosSettings> settings,
        ILogger<OfficeToPdfConverter> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public bool CanConvert(string extension)
    {
        return OfficeExtensions.Contains(extension.ToLowerInvariant());
    }

    public async Task<ErrorOr<string>> ConvertToPdfAsync(string inputPath, string outputDirectory, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(inputPath))
                return Error.Failure("Archivo.NotFound", "El archivo no existe");

            var fileNameWithoutExt = Path.GetFileNameWithoutExtension(inputPath);
            var outputPath = Path.Combine(outputDirectory, $"{fileNameWithoutExt}.pdf");

            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = _settings.LibreOfficePath,
                Arguments = $"--headless --convert-to pdf --outdir \"{outputDirectory}\" \"{inputPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            _logger.LogInformation("Convirtiendo {InputPath} a PDF usando LibreOffice", inputPath);

            using var process = System.Diagnostics.Process.Start(startInfo);
            if (process == null)
            {
                _logger.LogError("No se pudo iniciar el proceso de LibreOffice");
                return Error.Failure("Archivo.ConversionFailed", "No se pudo iniciar LibreOffice");
            }

            await process.WaitForExitAsync(cancellationToken);

            if (process.ExitCode != 0)
            {
                var error = await process.StandardError.ReadToEndAsync(cancellationToken);
                _logger.LogError("LibreOffice falló con código {ExitCode}: {Error}", process.ExitCode, error);
                return Error.Failure("Archivo.ConversionFailed", $"LibreOffice falló: {error}");
            }

            if (!File.Exists(outputPath))
            {
                _logger.LogError("El archivo PDF no fue generado en {OutputPath}", outputPath);
                return Error.Failure("Archivo.ConversionFailed", "El archivo PDF no fue generado");
            }

            _logger.LogInformation("Archivo convertido exitosamente a {OutputPath}", outputPath);
            return outputPath;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error convirtiendo archivo a PDF");
            return Error.Failure("Archivo.ConversionFailed", ex.Message);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Archivos/Conversores/OfficeToPdfConverter.cs
git commit -m "feat(archivos): add OfficeToPdfConverter with LibreOffice headless"
```

---

### Task 10: Service Interface

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/Services/IArchivoService.cs`

- [ ] **Step 1: Create IArchivoService**

```csharp
using ErrorOr;
using Lefarma.API.Features.Archivos.DTOs;

namespace Lefarma.API.Features.Archivos.Services;

public interface IArchivoService
{
    Task<ErrorOr<ArchivoResponse>> SubirAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        SubirArchivoRequest request,
        int? usuarioId = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoResponse>> ReemplazarAsync(
        int id,
        Stream fileStream,
        string fileName,
        string contentType,
        string? metadata = null,
        int? usuarioId = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoResponse>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    
    Task<ErrorOr<IEnumerable<ArchivoListItemResponse>>> GetAllAsync(
        ListarArchivosQuery query,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> DownloadAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> PreviewAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Archivos/Services/IArchivoService.cs
git commit -m "feat(archivos): add IArchivoService interface"
```

---

### Task 11: Service Implementation

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/Services/ArchivoService.cs`

- [ ] **Step 1: Create ArchivoService**

```csharp
using System.Text.Json;
using ErrorOr;
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.Conversores;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Archivos.Services;

public class ArchivoService : IArchivoService
{
    private readonly IArchivoRepository _repository;
    private readonly IOfficeToPdfConverter _pdfConverter;
    private readonly ArchivosSettings _settings;
    private readonly ILogger<ArchivoService> _logger;

    public ArchivoService(
        IArchivoRepository repository,
        IOfficeToPdfConverter pdfConverter,
        IOptions<ArchivosSettings> settings,
        ILogger<ArchivoService> logger)
    {
        _repository = repository;
        _pdfConverter = pdfConverter;
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

        return archivos.Select(MapToListItemResponse);
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

        // Si es PDF o imagen, devolver directamente
        var extensionesDirectas = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        if (extensionesDirectas.Contains(archivo.Extension.ToLowerInvariant()))
        {
            var stream = new FileStream(rutaOriginal, FileMode.Open, FileAccess.Read);
            return (stream, archivo.NombreOriginal, archivo.TipoMime);
        }

        // Si es Office, convertir a PDF
        if (_pdfConverter.CanConvert(archivo.Extension))
        {
            var directorioTemp = Path.Combine(_settings.BasePath, archivo.Carpeta, "temp");
            Directory.CreateDirectory(directorioTemp);

            var resultado = await _pdfConverter.ConvertToPdfAsync(rutaOriginal, directorioTemp, cancellationToken);
            if (resultado.IsError)
                return Errors.Archivo.PreviewNotSupported;

            var rutaPdf = resultado.Value;
            var pdfStream = new FileStream(rutaPdf, FileMode.Open, FileAccess.Read);
            return (pdfStream, $"{Path.GetFileNameWithoutExtension(archivo.NombreOriginal)}.pdf", "application/pdf");
        }

        // No soportado
        return Errors.Archivo.PreviewNotSupported;
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
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Archivos/Services/ArchivoService.cs
git commit -m "feat(archivos): add ArchivoService implementation"
```

---

### Task 12: Controller

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Archivos/Controllers/ArchivosController.cs`

- [ ] **Step 1: Create ArchivosController**

```csharp
using ErrorOr;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Archivos.Controllers;

[ApiController]
[Route("api/archivos")]
public class ArchivosController : ControllerBase
{
    private readonly IArchivoService _service;

    public ArchivosController(IArchivoService service)
    {
        _service = service;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(50_000_000)] // 50MB
    public async Task<IActionResult> Upload([FromForm] SubirArchivoRequest request, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Failure("No se proporcionó ningún archivo"));

        using var stream = file.OpenReadStream();
        var result = await _service.SubirAsync(stream, file.FileName, file.ContentType, request);

        return result.Match(
            archivo => Ok(ApiResponse<ArchivoResponse>.Success(archivo, "Archivo subido exitosamente")),
            errors => Problem(errors)
        );
    }

    [HttpPost("{id:int}/reemplazar")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> Reemplazar(int id, IFormFile file, [FromForm] string? metadata)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<object>.Failure("No se proporcionó ningún archivo"));

        using var stream = file.OpenReadStream();
        var result = await _service.ReemplazarAsync(id, stream, file.FileName, file.ContentType, metadata);

        return result.Match(
            archivo => Ok(ApiResponse<ArchivoResponse>.Success(archivo, "Archivo reemplazado exitosamente")),
            errors => Problem(errors)
        );
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);

        return result.Match(
            archivo => Ok(ApiResponse<ArchivoResponse>.Success(archivo)),
            errors => Problem(errors)
        );
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ListarArchivosQuery query)
    {
        var result = await _service.GetAllAsync(query);

        return result.Match(
            archivos => Ok(ApiResponse<IEnumerable<ArchivoListItemResponse>>.Success(archivos)),
            errors => Problem(errors)
        );
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var result = await _service.DownloadAsync(id);

        return result.Match(
            data => File(data.Stream, data.ContentType, data.FileName),
            errors => Problem(errors)
        );
    }

    [HttpGet("{id:int}/preview")]
    public async Task<IActionResult> Preview(int id)
    {
        var result = await _service.PreviewAsync(id);

        return result.Match(
            data => File(data.Stream, data.ContentType, data.FileName),
            errors => errors.First().Type switch
            {
                ErrorType.NotFound => NotFound(),
                ErrorType.Failure => StatusCode(415, ApiResponse<object>.Failure("Formato no soportado para previsualización")),
                _ => Problem(errors)
            }
        );
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _service.DeleteAsync(id);

        return result.Match(
            _ => Ok(ApiResponse<object>.Success(null, "Archivo eliminado exitosamente")),
            errors => Problem(errors)
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Archivos/Controllers/ArchivosController.cs
git commit -m "feat(archivos): add ArchivosController with all endpoints"
```

---

### Task 13: Register Services in Program.cs

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Program.cs`

- [ ] **Step 1: Add service registrations**

Buscar donde se registran otros servicios y agregar:
```csharp
// Archivos
builder.Services.Configure<Features.Archivos.Settings.ArchivosSettings>(
    builder.Configuration.GetSection("ArchivosSettings"));
builder.Services.AddScoped<Domain.Interfaces.IArchivoRepository, Infrastructure.Data.Repositories.ArchivoRepository>();
builder.Services.AddScoped<Features.Archivos.Conversores.IOfficeToPdfConverter, Features.Archivos.Conversores.OfficeToPdfConverter>();
builder.Services.AddScoped<Features.Archivos.Services.IArchivoService, Features.Archivos.Services.ArchivoService>();
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Program.cs
git commit -m "feat(archivos): register Archivos services in Program.cs"
```

---

### Task 14: Create Migration

**Files:**
- Generated migration

- [ ] **Step 1: Generate migration**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet ef migrations add AddArchivosTable
```

- [ ] **Step 2: Verify migration generated**

```bash
ls Migrations/
```

- [ ] **Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Migrations/
git commit -m "feat(archivos): add migration for Archivos table"
```

---

## Phase 3: Frontend

### Task 15: Types

**Files:**
- Create: `lefarma.frontend/src/types/archivo.types.ts`

- [ ] **Step 1: Create archivo.types.ts**

```typescript
export interface Archivo {
  id: number;
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  nombreOriginal: string;
  nombreFisico: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  metadata: unknown;
  fechaCreacion: string;
  fechaEdicion: string | null;
  usuarioId: number | null;
  activo: boolean;
}

export interface ArchivoListItem {
  id: number;
  nombreOriginal: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  fechaCreacion: string;
  activo: boolean;
}

export interface ListarArchivosParams {
  entidadTipo?: string;
  entidadId?: number;
  soloActivos?: boolean;
}

export interface SubirArchivoParams {
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  metadata?: unknown;
}

export interface ReemplazarArchivoParams {
  metadata?: unknown;
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/types/archivo.types.ts
git commit -m "feat(archivos): add archivo types"
```

---

### Task 16: Service

**Files:**
- Create: `lefarma.frontend/src/services/archivoService.ts`

- [ ] **Step 1: Install dependencies (if needed)**

```bash
cd lefarma.frontend
npm install pdfjs-dist
```

- [ ] **Step 2: Create archivoService.ts**

```typescript
import { api } from './api';
import type { 
  Archivo, 
  ArchivoListItem, 
  ListarArchivosParams, 
  SubirArchivoParams,
  ReemplazarArchivoParams 
} from '@/types/archivo.types';

const BASE_URL = '/archivos';

export const archivoService = {
  upload: async (file: File, params: SubirArchivoParams): Promise<Archivo> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entidadTipo', params.entidadTipo);
    formData.append('entidadId', params.entidadId.toString());
    formData.append('carpeta', params.carpeta);
    if (params.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata));
    }

    const { data } = await api.post<Archivo>(`${BASE_URL}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  reemplazar: async (id: number, file: File, params?: ReemplazarArchivoParams): Promise<Archivo> => {
    const formData = new FormData();
    formData.append('file', file);
    if (params?.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata));
    }

    const { data } = await api.post<Archivo>(`${BASE_URL}/${id}/reemplazar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  getById: async (id: number): Promise<Archivo> => {
    const { data } = await api.get<Archivo>(`${BASE_URL}/${id}`);
    return data;
  },

  getAll: async (params: ListarArchivosParams): Promise<ArchivoListItem[]> => {
    const { data } = await api.get<ArchivoListItem[]>(BASE_URL, { params });
    return data;
  },

  getDownloadUrl: (id: number): string => {
    return `/api${BASE_URL}/${id}/download`;
  },

  getPreviewUrl: (id: number): string => {
    return `/api${BASE_URL}/${id}/preview`;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add lefarma.frontend/src/services/archivoService.ts
git commit -m "feat(archivos): add archivoService"
```

---

### Task 17: FileUploader Component

**Files:**
- Create: `lefarma.frontend/src/components/archivos/FileUploader.tsx`

- [ ] **Step 1: Create FileUploader.tsx**

```tsx
import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileIcon, AlertCircle } from 'lucide-react';
import { archivoService } from '@/services/archivoService';
import type { Archivo, SubirArchivoParams } from '@/types/archivo.types';
import { toast } from 'sonner';

interface FileUploaderProps {
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  metadata?: unknown;
  tiposPermitidos?: string[];
  tamanoMaximoMB?: number;
  cantidadMaxima?: number;
  multiple?: boolean;
  titulo?: string;
  descripcion?: string;
  textoErrorTipo?: string;
  textoErrorTamano?: string;
  textoErrorCantidad?: string;
  open: boolean;
  onUploadComplete: (archivos: Archivo[]) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

const DEFAULT_TIPOS_PERMITIDOS = ['.pdf', '.xlsx', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
const DEFAULT_TAMANO_MAXIMO_MB = 10;
const DEFAULT_CANTIDAD_MAXIMA = 1;

export function FileUploader({
  entidadTipo,
  entidadId,
  carpeta,
  metadata,
  tiposPermitidos = DEFAULT_TIPOS_PERMITIDOS,
  tamanoMaximoMB = DEFAULT_TAMANO_MAXIMO_MB,
  cantidadMaxima = DEFAULT_CANTIDAD_MAXIMA,
  multiple = false,
  titulo = 'Subir archivo',
  descripcion = 'Arrastrá o hacé clic para seleccionar',
  textoErrorTipo = 'Tipo de archivo no permitido',
  textoErrorTamano = 'El archivo excede el tamaño máximo',
  textoErrorCantidad = 'Máximo excedido',
  open,
  onUploadComplete,
  onError,
  onClose
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!tiposPermitidos.includes(extension)) {
      return textoErrorTipo;
    }

    if (file.size > tamanoMaximoMB * 1024 * 1024) {
      return textoErrorTamano;
    }

    return null;
  }, [tiposPermitidos, tamanoMaximoMB, textoErrorTipo, textoErrorTamano]);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles = Array.from(fileList);
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    if (files.length + newFiles.length > cantidadMaxima) {
      newErrors.push(`${textoErrorCantidad}: ${cantidadMaxima}`);
      setErrors(newErrors);
      return;
    }

    newFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    setErrors(newErrors);
    setFiles(prev => [...prev, ...validFiles].slice(0, cantidadMaxima));
  }, [files.length, cantidadMaxima, validateFile, textoErrorCantidad]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const uploadedArchivos: Archivo[] = [];
    const uploadErrors: string[] = [];

    const params: SubirArchivoParams = {
      entidadTipo,
      entidadId,
      carpeta,
      metadata
    };

    for (const file of files) {
      try {
        const archivo = await archivoService.upload(file, params);
        uploadedArchivos.push(archivo);
      } catch (error) {
        uploadErrors.push(`${file.name}: Error al subir`);
      }
    }

    setUploading(false);

    if (uploadErrors.length > 0) {
      uploadErrors.forEach(err => toast.error(err));
      onError?.(uploadErrors.join(', '));
    }

    if (uploadedArchivos.length > 0) {
      toast.success(`${uploadedArchivos.length} archivo(s) subido(s)`);
      onUploadComplete(uploadedArchivos);
      setFiles([]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Drop zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">{descripcion}</p>
            <p className="text-sm text-gray-400 mt-2">
              Tipos: {tiposPermitidos.join(', ')} | Máx: {tamanoMaximoMB}MB
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={tiposPermitidos.join(',')}
              multiple={multiple}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              {errors.map((error, i) => (
                <div key={i} className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              ))}
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <FileIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/components/archivos/FileUploader.tsx
git commit -m "feat(archivos): add FileUploader component"
```

---

### Task 18: FileViewer Component

**Files:**
- Create: `lefarma.frontend/src/components/archivos/FileViewer.tsx`

- [ ] **Step 1: Create FileViewer.tsx**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileIcon, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { archivoService } from '@/services/archivoService';
import type { Archivo } from '@/types/archivo.types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface FileViewerProps {
  archivoId: number;
  titulo?: string;
  textoNoSoportado?: string;
  textoDescargar?: string;
  open: boolean;
  onClose: () => void;
}

export function FileViewer({
  archivoId,
  titulo,
  textoNoSoportado = 'Formato no soportado para previsualización',
  textoDescargar = 'Descargar',
  open,
  onClose
}: FileViewerProps) {
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notSupported, setNotSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadArchivo = useCallback(async () => {
    try {
      setLoading(true);
      setNotSupported(false);
      setError(null);
      
      const data = await archivoService.getById(archivoId);
      setArchivo(data);
    } catch (err) {
      setError('Error al cargar el archivo');
    } finally {
      setLoading(false);
    }
  }, [archivoId]);

  const renderPreview = useCallback(async () => {
    if (!archivo || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previewUrl = archivoService.getPreviewUrl(archivo.id);

    // Check if it's an image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (imageExtensions.includes(archivo.extension.toLowerCase())) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const containerWidth = containerRef.current?.clientWidth || 600;
        const scale = containerWidth / img.width;
        canvas.width = containerWidth;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.onerror = () => {
        setNotSupported(true);
        drawNotSupported();
      };
      img.src = previewUrl;
      return;
    }

    // Try to render as PDF
    try {
      const loadingTask = pdfjsLib.getDocument(previewUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const containerWidth = containerRef.current?.clientWidth || 600;
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport
      };

      await page.render(renderContext).promise;
    } catch (err) {
      // 415 error - not supported
      setNotSupported(true);
      drawNotSupported();
    }
  }, [archivo]);

  const drawNotSupported = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    canvas.width = containerWidth;
    canvas.height = 300;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Icon (draw a simple file icon shape)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    const iconX = canvas.width / 2 - 30;
    const iconY = 60;
    
    ctx.beginPath();
    ctx.moveTo(iconX, iconY);
    ctx.lineTo(iconX, iconY + 60);
    ctx.lineTo(iconX + 40, iconY + 60);
    ctx.lineTo(iconX + 40, iconY + 15);
    ctx.lineTo(iconX + 25, iconY);
    ctx.closePath();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(iconX + 25, iconY);
    ctx.lineTo(iconX + 25, iconY + 15);
    ctx.lineTo(iconX + 40, iconY + 15);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#64748b';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(textoNoSoportado, canvas.width / 2, 160);

    // File name
    if (archivo) {
      ctx.fillStyle = '#334155';
      ctx.font = '14px sans-serif';
      ctx.fillText(archivo.nombreOriginal, canvas.width / 2, 190);
    }
  }, [textoNoSoportado, archivo]);

  useEffect(() => {
    if (open && archivoId) {
      loadArchivo();
    }
  }, [open, archivoId, loadArchivo]);

  useEffect(() => {
    if (archivo && !loading) {
      renderPreview();
    }
  }, [archivo, loading, renderPreview]);

  const handleDownload = () => {
    if (archivo) {
      window.open(archivoService.getDownloadUrl(archivo.id), '_blank');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold truncate">
            {titulo || archivo?.nombreOriginal || 'Visor de archivos'}
          </h2>
          <div className="flex items-center gap-2">
            {archivo && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                {textoDescargar}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <AlertCircle className="w-12 h-12 mb-2" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <canvas
              ref={canvasRef}
              className="max-w-full shadow-lg"
            />
          )}
        </div>

        {/* Footer for not supported */}
        {notSupported && archivo && (
          <div className="p-4 border-t bg-gray-50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <FileIcon className="w-5 h-5" />
                <span className="text-sm">{archivo.nombreOriginal}</span>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                {textoDescargar}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/components/archivos/FileViewer.tsx
git commit -m "feat(archivos): add FileViewer component with canvas rendering"
```

---

### Task 19: Export Components

**Files:**
- Create: `lefarma.frontend/src/components/archivos/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
export { FileUploader } from './FileUploader';
export { FileViewer } from './FileViewer';
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/components/archivos/index.ts
git commit -m "feat(archivos): export archivos components"
```

---

## Phase 4: Final Verification

### Task 20: Build and Test

- [ ] **Step 1: Build backend**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet build
```

Expected: Build succeeded

- [ ] **Step 2: Build frontend**

```bash
cd lefarma.frontend
npm run build
```

Expected: Build succeeded

- [ ] **Step 3: Run backend tests (if any)**

```bash
cd lefarma.backend
dotnet test
```

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add .
git commit -m "fix(archivos): final build fixes"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-6 | Backend Domain & Infrastructure |
| 2 | 7-14 | Backend Feature Module |
| 3 | 15-19 | Frontend Components |
| 4 | 20 | Verification |

**Total Files Created:** 21
**Total Files Modified:** 3
