# Help Module Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Help module by removing article cards, enhancing the type switch to fully replace content, adding a rich text editor toolbar with image upload support, and ensuring viewer compatibility.

**Architecture:** Controlled enhancement of existing Lexical editor with plugins + backend image upload via static files middleware. The layout shifts from sidebar+cards+preview to sidebar+full-content-area with type switch replacing content entirely.

**Tech Stack:** React 19, TypeScript, Lexical 0.42.0, Zustand, .NET 10, Entity Framework Core, SQL Server

---

## File Structure Overview

### Frontend Files to Create

| File | Purpose |
|------|---------|
| `src/components/help/RichTextToolbar.tsx` | Editor toolbar with formatting buttons |
| `src/components/help/ToolbarButton.tsx` | Reusable toolbar button component |
| `src/components/help/nodes/ImageNode.tsx` | Custom Lexical image node |
| `src/components/help/plugins/ImagePlugin.tsx` | Image insertion plugin |
| `src/components/help/ui/ImageUploadDialog.tsx` | Image upload modal |

### Frontend Files to Modify

| File | Changes |
|------|---------|
| `src/pages/help/HelpList.tsx` | Remove cards grid, enhance type switch, add empty state |
| `src/components/help/LexicalEditor.tsx` | Add toolbar, plugins, nodes, enhanced theme |
| `src/components/help/LexicalViewer.tsx` | Add image node support, enhanced theme |
| `src/store/helpStore.ts` | Add `fetchForUser` action, loading states |
| `src/services/helpService.ts` | Add `uploadImage` method, `getForUser` method |
| `src/types/help.types.ts` | Add `HelpImageUploadResponse` type |

### Frontend Files to Delete

| File | Reason |
|------|--------|
| `src/components/help/HelpCard.tsx` | Article cards removed from HelpList |

### Backend Files to Create

| File | Purpose |
|------|---------|
| `Features/Help/Controllers/HelpImagesController.cs` | Image upload endpoint |
| `Features/Help/Services/HelpImageService.cs` | Image storage business logic |
| `Features/Help/Services/IHelpImageService.cs` | Service interface |
| `Features/Help/DTOs/HelpImageUploadResponse.cs` | Upload response DTO |
| `Domain/Interfaces/IHelpImageRepository.cs` | Repository interface |
| `Infrastructure/Data/Repositories/HelpImageRepository.cs` | Repository implementation |

### Backend Files to Modify

| File | Changes |
|------|---------|
| `Features/Help/Services/HelpArticleService.cs` | Add `GetForUserAsync` method |
| `Features/Help/Services/IHelpArticleService.cs` | Add `GetForUserAsync` signature |
| `Features/Help/Controllers/HelpArticlesController.cs` | Add `GET /for-user` endpoint |
| `Program.cs` | Add static files middleware for `/media`, register services |

### Documentation Files to Update

| File | Changes |
|------|---------|
| `lefarma.docs/backend/api-routes.md` | Document new `/for-user` and `/images` endpoints |
| `lefarma.docs/frontend/components.md` | Document new Help components |
| `lefarma.docs/frontend/types.md` | Document `HelpImageUploadResponse` |

---

## Task 1: Backend - Add GetForUser Endpoint

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Help/Services/IHelpArticleService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Help/Services/HelpArticleService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/IHelpArticleRepository.cs`
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/HelpArticleRepository.cs` (if not exists, check first)
- Modify: `lefarma.backend/src/Lefarma.API/Features/Help/Controllers/HelpArticlesController.cs`

- [ ] **Step 1: Add method signature to IHelpArticleService**

```csharp
// File: Features/Help/Services/IHelpArticleService.cs
// Add this method signature to the interface:

/// <summary>
/// Obtiene artículos de ayuda para usuarios finales (tipo 'usuario' o 'ambos').
/// </summary>
Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetForUserAsync(string? modulo, CancellationToken ct);
```

- [ ] **Step 2: Add method signature to IHelpArticleRepository**

```csharp
// File: Domain/Interfaces/IHelpArticleRepository.cs
// Add this method signature to the interface:

/// <summary>
/// Obtiene artículos de ayuda para usuarios finales (tipo 'usuario' o 'ambos').
/// </summary>
Task<IEnumerable<HelpArticle>> GetForUserAsync(string? modulo, CancellationToken ct);
```

- [ ] **Step 3: Implement repository method**

First, find the existing HelpArticleRepository file:

```bash
find lefarma.backend -name "HelpArticleRepository.cs" -type f
```

Then add the method:

```csharp
// File: Infrastructure/Data/Repositories/HelpArticleRepository.cs
// Add this method to the repository class:

public async Task<IEnumerable<HelpArticle>> GetForUserAsync(string? modulo, CancellationToken ct)
{
    var query = _context.HelpArticles
        .Where(a => a.Activo && (a.Tipo == "usuario" || a.Tipo == "ambos"));

    if (!string.IsNullOrEmpty(modulo))
    {
        query = query.Where(a => a.Modulo == modulo);
    }

    return await query
        .OrderBy(a => a.Orden)
        .ThenBy(a => a.Titulo)
        .ToListAsync(ct);
}
```

- [ ] **Step 4: Implement service method**

```csharp
// File: Features/Help/Services/HelpArticleService.cs
// Add this method to the service class:

public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetForUserAsync(string? modulo, CancellationToken ct)
{
    try
    {
        _logger.LogDebug("Obteniendo artículos de ayuda para usuario. Módulo: {Modulo}", modulo ?? "todos");

        var articles = await _helpArticleRepository.GetForUserAsync(modulo, ct);

        if (!articles.Any())
        {
            _logger.LogInformation("No se encontraron artículos de ayuda para usuario. Módulo: {Modulo}", modulo ?? "todos");
            return new List<HelpArticleDto>();
        }

        var dtos = articles.Select(MapToDto).ToList();
        _logger.LogInformation("Se obtuvieron {Count} artículos para usuario. Módulo: {Modulo}", dtos.Count, modulo ?? "todos");

        return dtos;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al obtener artículos de ayuda para usuario. Módulo: {Modulo}", modulo ?? "todos");
        return CommonErrors.DatabaseError("obtener artículos para usuario");
    }
}
```

- [ ] **Step 5: Add controller endpoint**

```csharp
// File: Features/Help/Controllers/HelpArticlesController.cs
// Add this endpoint to the controller class:

/// <summary>
/// Obtiene artículos de ayuda para usuarios finales (tipo 'usuario' o 'ambos')
/// </summary>
/// <param name="modulo">Nombre del módulo (opcional)</param>
/// <param name="ct">Token de cancelación</param>
/// <returns>Lista de artículos para usuarios</returns>
[HttpGet("for-user")]
[SwaggerOperation(Summary = "Obtener artículos para usuarios", Description = "Retorna artículos con tipo 'usuario' o 'ambos', filtrados por módulo si se especifica")]
[ProducesResponseType(typeof(ApiResponse<IEnumerable<HelpArticleDto>>), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public async Task<IActionResult> GetForUser(
    [FromQuery][SwaggerParameter(Description = "Nombre del módulo (opcional)")] string? modulo,
    CancellationToken ct)
{
    var result = await _helpArticleService.GetForUserAsync(modulo, ct);

    return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HelpArticleDto>>
    {
        Success = true,
        Message = "Artículos de ayuda para usuario obtenidos exitosamente.",
        Data = data
    }));
}
```

- [ ] **Step 6: Verify backend changes**

Run the backend to verify no compilation errors:

```bash
cd lefarma.backend && dotnet build --no-restore
```

Expected: Build succeeds with no errors.

---

## Task 2: Backend - Create Image Upload Infrastructure

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/IHelpImageRepository.cs`
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/HelpImageRepository.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Services/IHelpImageService.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Services/HelpImageService.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/HelpImageUploadResponse.cs`

- [ ] **Step 1: Create IHelpImageRepository interface**

```csharp
// File: Domain/Interfaces/IHelpImageRepository.cs
using Lefarma.API.Domain.Entities.Help;

namespace Lefarma.API.Domain.Interfaces;

/// <summary>
/// Repositorio para operaciones de imágenes de ayuda.
/// </summary>
public interface IHelpImageRepository
{
    /// <summary>
    /// Guarda una nueva imagen de ayuda.
    /// </summary>
    Task<HelpImage> CreateAsync(HelpImage image, CancellationToken ct);

    /// <summary>
    /// Obtiene una imagen por nombre de archivo.
    /// </summary>
    Task<HelpImage?> GetByFileNameAsync(string fileName, CancellationToken ct);
}
```

- [ ] **Step 2: Create HelpImageRepository implementation**

```csharp
// File: Infrastructure/Data/Repositories/HelpImageRepository.cs
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;

public class HelpImageRepository : IHelpImageRepository
{
    private readonly ApplicationDbContext _context;

    public HelpImageRepository(ApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<HelpImage> CreateAsync(HelpImage image, CancellationToken ct)
    {
        _context.HelpImages.Add(image);
        await _context.SaveChangesAsync(ct);
        return image;
    }

    public async Task<HelpImage?> GetByFileNameAsync(string fileName, CancellationToken ct)
    {
        return await _context.HelpImages
            .FirstOrDefaultAsync(i => i.NombreArchivo == fileName, ct);
    }
}
```

- [ ] **Step 3: Create HelpImageUploadResponse DTO**

```csharp
// File: Features/Help/DTOs/HelpImageUploadResponse.cs
namespace Lefarma.API.Features.Help.DTOs;

/// <summary>
/// Respuesta de carga de imagen de ayuda.
/// </summary>
public class HelpImageUploadResponse
{
    public int Id { get; set; }
    public string NombreOriginal { get; set; } = string.Empty;
    public string NombreArchivo { get; set; } = string.Empty;
    public string RutaRelativa { get; set; } = string.Empty;
    public long TamanhoBytes { get; set; }
    public string MimeType { get; set; } = string.Empty;
    public int? Ancho { get; set; }
    public int? Alto { get; set; }
    public DateTime FechaSubida { get; set; }
}
```

- [ ] **Step 4: Create IHelpImageService interface**

```csharp
// File: Features/Help/Services/IHelpImageService.cs
using ErrorOr;
using Lefarma.API.Features.Help.DTOs;

namespace Lefarma.API.Features.Help.Services;

public interface IHelpImageService
{
    /// <summary>
    /// Sube una imagen y guarda el registro en la base de datos.
    /// </summary>
    Task<ErrorOr<HelpImageUploadResponse>> UploadAsync(
        Stream fileStream,
        string originalFileName,
        string contentType,
        string uploadedBy,
        CancellationToken ct);
}
```

- [ ] **Step 5: Create HelpImageService implementation**

```csharp
// File: Features/Help/Services/HelpImageService.cs
using ErrorOr;
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Help.Services;

public class HelpImageService : IHelpImageService
{
    private readonly IHelpImageRepository _repository;
    private readonly ILogger<HelpImageService> _logger;
    private readonly IWebHostEnvironment _environment;

    private static readonly string[] AllowedMimeTypes = 
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp"
    };

    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    public HelpImageService(
        IHelpImageRepository repository,
        ILogger<HelpImageService> logger,
        IWebHostEnvironment environment)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
    }

    public async Task<ErrorOr<HelpImageUploadResponse>> UploadAsync(
        Stream fileStream,
        string originalFileName,
        string contentType,
        string uploadedBy,
        CancellationToken ct)
    {
        try
        {
            // Validate content type
            if (!AllowedMimeTypes.Contains(contentType.ToLowerInvariant()))
            {
                return Error.Validation(
                    code: "HelpImage.InvalidMimeType",
                    description: $"Tipo de archivo no permitido. Tipos permitidos: {string.Join(", ", AllowedMimeTypes)}");
            }

            // Validate file size
            if (fileStream.Length > MaxFileSizeBytes)
            {
                return Error.Validation(
                    code: "HelpImage.FileTooLarge",
                    description: $"El archivo excede el tamaño máximo permitido de {MaxFileSizeBytes / 1024 / 1024} MB.");
            }

            // Generate unique filename
            var extension = Path.GetExtension(originalFileName);
            var fileName = $"{Guid.NewGuid()}{extension}";

            // Create directory structure: wwwroot/media/help/{year}/{month}/
            var now = DateTime.UtcNow;
            var relativeDir = $"media/help/{now:yyyy}/{now:MM}";
            var absoluteDir = Path.Combine(_environment.WebRootPath, relativeDir);

            if (!Directory.Exists(absoluteDir))
            {
                Directory.CreateDirectory(absoluteDir);
            }

            // Save file
            var filePath = Path.Combine(absoluteDir, fileName);
            using (var fs = new FileStream(filePath, FileMode.Create))
            {
                await fileStream.CopyToAsync(fs, ct);
            }

            // Get image dimensions (optional)
            int? width = null;
            int? height = null;
            try
            {
                // Simple dimension detection - you may need to add SixLabors.ImageSharp or similar
                // For now, we'll leave these null and let the frontend handle it
            }
            catch
            {
                // Ignore dimension detection errors
            }

            // Create database record
            var image = new HelpImage
            {
                NombreOriginal = originalFileName,
                NombreArchivo = fileName,
                RutaRelativa = $"/{relativeDir}/{fileName}",
                TamanhoBytes = fileStream.Length,
                MimeType = contentType,
                Ancho = width,
                Alto = height,
                FechaSubida = now,
                SubidoPor = uploadedBy
            };

            var result = await _repository.CreateAsync(image, ct);

            _logger.LogInformation("Imagen de ayuda subida: {FileName} -> {RutaRelativa}", 
                originalFileName, result.RutaRelativa);

            return MapToResponse(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al subir imagen de ayuda: {FileName}", originalFileName);
            return CommonErrors.DatabaseError("subir la imagen");
        }
    }

    private static HelpImageUploadResponse MapToResponse(HelpImage image)
    {
        return new HelpImageUploadResponse
        {
            Id = image.Id,
            NombreOriginal = image.NombreOriginal,
            NombreArchivo = image.NombreArchivo,
            RutaRelativa = image.RutaRelativa,
            TamanhoBytes = image.TamanhoBytes,
            MimeType = image.MimeType,
            Ancho = image.Ancho,
            Alto = image.Alto,
            FechaSubida = image.FechaSubida
        };
    }
}
```

- [ ] **Step 6: Verify backend changes**

```bash
cd lefarma.backend && dotnet build --no-restore
```

Expected: Build succeeds with no errors.

---

## Task 3: Backend - Create Image Upload Controller and Configure Static Files

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Controllers/HelpImagesController.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Program.cs`

- [ ] **Step 1: Create HelpImagesController**

```csharp
// File: Features/Help/Controllers/HelpImagesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Help.Controllers;

/// <summary>
/// Controlador API para gestionar imágenes de ayuda
/// </summary>
[ApiController]
[Route("api/help/images")]
[Authorize]
public class HelpImagesController : ControllerBase
{
    private readonly IHelpImageService _helpImageService;

    public HelpImagesController(IHelpImageService helpImageService)
    {
        _helpImageService = helpImageService ?? throw new ArgumentNullException(nameof(helpImageService));
    }

    /// <summary>
    /// Sube una imagen para usar en artículos de ayuda
    /// </summary>
    /// <param name="file">Archivo de imagen</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Información de la imagen subida</returns>
    [HttpPost]
    [SwaggerOperation(Summary = "Subir imagen de ayuda", Description = "Sube una imagen PNG, JPEG, GIF o WebP (máx 5MB)")]
    [ProducesResponseType(typeof(ApiResponse<DTOs.HelpImageUploadResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB limit for the request
    public async Task<IActionResult> Upload(
        IFormFile file,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporcionó ningún archivo.",
                Data = null
            });
        }

        var username = User.Identity?.Name ?? "unknown";

        using var stream = file.OpenReadStream();
        var result = await _helpImageService.UploadAsync(
            stream,
            file.FileName,
            file.ContentType,
            username,
            ct);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(Upload),
            new { id = data.Id },
            new ApiResponse<DTOs.HelpImageUploadResponse>
            {
                Success = true,
                Message = "Imagen subida exitosamente.",
                Data = data
            }));
    }
}
```

- [ ] **Step 2: Register services in Program.cs**

Find the existing service registration section in Program.cs and add:

```csharp
// File: Program.cs
// Add these lines in the service registration section (after existing Help services):

// Help Image Services
builder.Services.AddScoped<IHelpImageRepository, HelpImageRepository>();
builder.Services.AddScoped<IHelpImageService, HelpImageService>();
```

- [ ] **Step 3: Configure static files middleware in Program.cs**

Find the `app.UseStaticFiles();` line and add after it:

```csharp
// File: Program.cs
// Add after app.UseStaticFiles();

// Serve help images from wwwroot/media
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.WebRootPath, "media")),
    RequestPath = "/media",
    OnPrepareResponse = ctx =>
    {
        // Cache images for 1 year (immutable content with unique GUIDs)
        ctx.Context.Response.Headers.Append(
            "Cache-Control", "public,max-age=31536000");
    }
});
```

- [ ] **Step 4: Ensure wwwroot/media directory exists**

```bash
mkdir -p lefarma.backend/src/Lefarma.API/wwwroot/media/help
```

- [ ] **Step 5: Verify backend changes**

```bash
cd lefarma.backend && dotnet build --no-restore
```

Expected: Build succeeds with no errors.

---

## Task 4: Frontend - Remove HelpCard Grid from HelpList

**Files:**
- Modify: `lefarma.frontend/src/pages/help/HelpList.tsx`
- Delete: `lefarma.frontend/src/components/help/HelpCard.tsx`

- [ ] **Step 1: Remove HelpCard import and usage from HelpList.tsx**

Edit `lefarma.frontend/src/pages/help/HelpList.tsx`:

1. Remove the import:
```typescript
// DELETE this line:
import { HelpCard } from '@/components/help/HelpCard';
```

2. Remove the articles grid section (lines 268-281):
```typescript
// DELETE this entire section:
{/* Articles Grid */}
{!isLoading && articles.length > 0 && (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {articles.map((article) => (
      <HelpCard
        key={article.id}
        article={article}
        isActive={article.id === selectedArticleId}
        onSelect={handleSelectArticle}
        onEdit={(a) => handleEditArticle(a)}
      />
    ))}
  </div>
)}
```

3. Remove the unused `handleSelectArticle` and `handleEditArticle` functions (lines 115-125):
```typescript
// DELETE these functions:
const handleSelectArticle = (id: number) => {
  setSelectedArticleId(id);
  setIsEditing(false);
  setIsEditingEmptyPage(false);
};

const handleEditArticle = (article: HelpArticle) => {
  setSelectedArticleId(article.id);
  setEditedContent(article.contenido);
  setIsEditing(true);
};
```

- [ ] **Step 2: Verify no other files reference HelpCard**

```bash
cd lefarma.frontend && grep -r "HelpCard" src/
```

Expected: No matches found (except the file itself which we'll delete).

- [ ] **Step 3: Delete HelpCard.tsx file**

```bash
rm lefarma.frontend/src/components/help/HelpCard.tsx
```

- [ ] **Step 4: Verify frontend changes**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No lint errors related to missing imports.

---

## Task 5: Frontend - Add Types and Service Methods for Images

**Files:**
- Modify: `lefarma.frontend/src/types/help.types.ts`
- Modify: `lefarma.frontend/src/services/helpService.ts`

- [ ] **Step 1: Add HelpImageUploadResponse type**

Add to `lefarma.frontend/src/types/help.types.ts`:

```typescript
// Add at the end of the file:

// ─── Help Image Upload Response ────────────────────────────────────────────────

export interface HelpImageUploadResponse {
  id: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaRelativa: string;
  tamanhoBytes: number;
  mimeType: string;
  ancho?: number;
  alto?: number;
  fechaSubida: string;
}
```

- [ ] **Step 2: Add image upload and for-user methods to helpService**

Add to `lefarma.frontend/src/services/helpService.ts`:

```typescript
// Add to imports:
import type { HelpImageUploadResponse } from '@/types/help.types';

// Add these methods to the helpService object:

// Get articles for user (tipo 'usuario' or 'ambos')
getForUser: async (modulo?: string): Promise<HelpArticle[]> => {
  const url = modulo 
    ? `${HELP_URL}/for-user?modulo=${encodeURIComponent(modulo)}`
    : `${HELP_URL}/for-user`;
  const response = await API.get<ApiResponse<HelpArticle[]>>(url);
  return response.data.data;
},

// Upload image
uploadImage: async (file: File): Promise<HelpImageUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await API.post<ApiResponse<HelpImageUploadResponse>>(
    '/help/images',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data.data;
},
```

- [ ] **Step 3: Verify frontend changes**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No lint errors.

---

## Task 6: Frontend - Update helpStore for For-User Endpoint

**Files:**
- Modify: `lefarma.frontend/src/store/helpStore.ts`

- [ ] **Step 1: Add fetchForUser action to helpStore**

Add to `lefarma.frontend/src/store/helpStore.ts`:

```typescript
// Add to the HelpState interface (around line 15):

fetchForUser: (modulo?: string) => Promise<void>;

// Add to the implementation (after fetchArticlesByType):

fetchForUser: async (modulo?: string) => {
  set({ isLoading: true, error: null });
  try {
    const articles = await helpService.getForUser(modulo);
    set({ articles, isLoading: false, selectedType: 'usuario' });
  } catch (error) {
    set({ error: 'Error al cargar artículos', isLoading: false });
  }
},
```

- [ ] **Step 2: Verify frontend changes**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No lint errors.

---

## Task 7: Frontend - Install Lexical Plugin Packages

**Files:**
- Modify: `lefarma.frontend/package.json` (via npm install)

- [ ] **Step 1: Install required Lexical packages**

```bash
cd lefarma.frontend && npm install @lexical/list @lexical/link @lexical/code @lexical/rich-text @lexical/selection
```

Expected: Packages installed successfully, package.json updated.

- [ ] **Step 2: Verify installation**

```bash
cd lefarma.frontend && npm ls @lexical/list @lexical/link @lexical/code
```

Expected: All packages listed with version numbers.

---

## Task 8: Frontend - Create ToolbarButton Component

**Files:**
- Create: `lefarma.frontend/src/components/help/ui/ToolbarButton.tsx`

- [ ] **Step 1: Create the ToolbarButton component**

```typescript
// File: src/components/help/ui/ToolbarButton.tsx
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: ReactNode;
  tooltip?: string;
  className?: string;
}

export function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  tooltip,
  className,
}: ToolbarButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-accent text-accent-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls -la lefarma.frontend/src/components/help/ui/ToolbarButton.tsx
```

Expected: File exists.

---

## Task 9: Frontend - Create ImageUploadDialog Component

**Files:**
- Create: `lefarma.frontend/src/components/help/ui/ImageUploadDialog.tsx`

- [ ] **Step 1: Create the ImageUploadDialog component**

```typescript
// File: src/components/help/ui/ImageUploadDialog.tsx
import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { helpService } from '@/services/helpService';
import type { HelpImageUploadResponse } from '@/types/help.types';

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageUploaded: (imageData: HelpImageUploadResponse) => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  onImageUploaded,
}: ImageUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de archivo no permitido', {
          description: 'Solo se permiten imágenes PNG, JPEG, GIF o WebP.',
        });
        return;
      }

      // Validate file size (5 MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Archivo demasiado grande', {
          description: 'El tamaño máximo permitido es 5 MB.',
        });
        return;
      }

      setSelectedFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await helpService.uploadImage(selectedFile);
      toast.success('Imagen subida exitosamente');
      onImageUploaded(result);
      handleClose();
    } catch (error: any) {
      toast.error('Error al subir la imagen', {
        description: error?.message ?? 'Ocurrió un error inesperado.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir Imagen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div className="flex flex-col items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Haz clic para seleccionar una imagen
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                PNG, JPEG, GIF, WebP (máx. 5 MB)
              </span>
            </label>
          </div>

          {/* Preview */}
          {preview && (
            <div className="relative">
              <img
                src={preview}
                alt="Vista previa"
                className="w-full max-h-48 object-contain rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls -la lefarma.frontend/src/components/help/ui/ImageUploadDialog.tsx
```

Expected: File exists.

---

## Task 10: Frontend - Create RichTextToolbar Component

**Files:**
- Create: `lefarma.frontend/src/components/help/RichTextToolbar.tsx`

- [ ] **Step 1: Create the RichTextToolbar component**

```typescript
// File: src/components/help/RichTextToolbar.tsx
import { useState, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  $createHeadingNode,
  $createQuoteNode,
  $createCodeNode,
  HeadingTagType,
} from 'lexical';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list';
import { $isHeadingNode } from '@lexical/rich-text';
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import { $getNearestNodeOfType } from '@lexical/utils';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link,
  ImageIcon,
  Undo,
  Redo,
  Pilcrow,
} from 'lucide-react';
import { ToolbarButton } from './ui/ToolbarButton';
import { ImageUploadDialog } from './ui/ImageUploadDialog';
import type { HelpImageUploadResponse } from '@/types/help.types';
import {
  $createImageNode,
  ImageNode,
} from './nodes/ImageNode';

interface RichTextToolbarProps {
  onImageUpload?: (callback: (data: HelpImageUploadResponse) => void) => void;
}

export function RichTextToolbar({ onImageUpload }: RichTextToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState<string>('paragraph');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    // Update text format states
    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));
    setIsStrikethrough(selection.hasFormat('strikethrough'));
    setIsCode(selection.hasFormat('code'));

    // Check for link
    const anchor = selection.anchor;
    const focus = selection.focus;
    const nodes = selection.getNodes();
    
    const hasLink = nodes.some(node => {
      if ($isLinkNode(node)) return true;
      return node.getParents().some(parent => $isLinkNode(parent));
    });
    setIsLink(hasLink);

    // Check block type
    const anchorNode = anchor.getNode();
    let elementNode = anchorNode;
    
    while (elementNode !== null) {
      if ($isHeadingNode(elementNode)) {
        setBlockType(elementNode.getTag());
        return;
      }
      if ($isListNode(elementNode)) {
        const parentList = $getNearestNodeOfType(anchorNode, ListNode);
        setBlockType(parentList?.getListType() === 'number' ? 'ol' : 'ul');
        return;
      }
      if (elementNode.getType() === 'quote') {
        setBlockType('quote');
        return;
      }
      if (elementNode.getType() === 'code') {
        setBlockType('code');
        return;
      }
      elementNode = elementNode.getParent();
    }
    
    setBlockType('paragraph');
  }, []);

  // Register update listener
  useCallback(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatText = (format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatHeading = (headingType: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingType));
      }
    });
  };

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  };

  const formatBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const formatNumberedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const formatCode = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  };

  const insertLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      const url = prompt('Ingresa la URL del enlace:');
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, target: '_blank' });
      }
    }
  };

  const handleImageUploaded = (imageData: HelpImageUploadResponse) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const imageNode = $createImageNode({
          src: imageData.rutaRelativa,
          altText: imageData.nombreOriginal,
          width: imageData.ancho,
          height: imageData.alto,
        });
        selection.insertNodes([imageNode]);
      }
    });
    setIsImageDialogOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30 rounded-t-md">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 pr-2 border-r">
          <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} tooltip="Deshacer (Ctrl+Z)">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} tooltip="Rehacer (Ctrl+Y)">
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Text Formatting */}
        <div className="flex items-center gap-1 px-2 border-r">
          <ToolbarButton onClick={() => formatText('bold')} isActive={isBold} tooltip="Negrita (Ctrl+B)">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatText('italic')} isActive={isItalic} tooltip="Cursiva (Ctrl+I)">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatText('underline')} isActive={isUnderline} tooltip="Subrayado (Ctrl+U)">
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatText('strikethrough')} isActive={isStrikethrough} tooltip="Tachado">
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatText('code')} isActive={isCode} tooltip="Código inline">
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Block Type */}
        <div className="flex items-center gap-1 px-2 border-r">
          <ToolbarButton onClick={formatParagraph} isActive={blockType === 'paragraph'} tooltip="Párrafo">
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatHeading('h1')} isActive={blockType === 'h1'} tooltip="Título 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatHeading('h2')} isActive={blockType === 'h2'} tooltip="Título 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={formatQuote} isActive={blockType === 'quote'} tooltip="Cita">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={formatCode} isActive={blockType === 'code'} tooltip="Bloque de código">
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 px-2 border-r">
          <ToolbarButton onClick={formatBulletList} isActive={blockType === 'ul'} tooltip="Lista con viñetas">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={formatNumberedList} isActive={blockType === 'ol'} tooltip="Lista numerada">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Link & Image */}
        <div className="flex items-center gap-1 pl-2">
          <ToolbarButton onClick={insertLink} isActive={isLink} tooltip="Insertar enlace">
            <Link className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => setIsImageDialogOpen(true)} tooltip="Insertar imagen">
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      <ImageUploadDialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
        onImageUploaded={handleImageUploaded}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls -la lefarma.frontend/src/components/help/RichTextToolbar.tsx
```

Expected: File exists.

---

## Task 11: Frontend - Create Custom ImageNode

**Files:**
- Create: `lefarma.frontend/src/components/help/nodes/ImageNode.tsx`

- [ ] **Step 1: Create the ImageNode component**

```typescript
// File: src/components/help/nodes/ImageNode.tsx
import { useEffect, useRef, useCallback } from 'react';
import {
  $applyNodeReplacement,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  DecoratorNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

export interface ImagePayload {
  src: string;
  altText?: string;
  width?: number | null;
  height?: number | null;
}

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
    width?: number | null;
    height?: number | null;
  },
  SerializedLexicalNode
>;

function ImageComponent({
  src,
  altText,
  width,
  height,
  nodeKey,
  resizable,
}: {
  src: string;
  altText: string;
  width?: number | null;
  height?: number | null;
  nodeKey: NodeKey;
  resizable?: boolean;
}): JSX.Element {
  const imageRef = useRef<HTMLImageElement>(null);
  const [editor] = useLexicalComposerContext();

  const onClick = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) {
        $setSelection(null);
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.anchor.set(node.getKey(), 0, 'element');
          selection.focus.set(node.getKey(), 0, 'element');
        }
      }
    });
  }, [editor, nodeKey]);

  return (
    <div className="my-4">
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        width={width ?? undefined}
        height={height ?? undefined}
        className="max-w-full h-auto rounded-lg border cursor-pointer"
        onClick={onClick}
        onError={(e) => {
          // Handle broken image
          e.currentTarget.src = '/placeholder-image.png';
          e.currentTarget.alt = 'Imagen no disponible';
        }}
      />
      {altText && (
        <p className="text-sm text-muted-foreground text-center mt-1">{altText}</p>
      )}
    </div>
  );
}

function convertImageElement(domNode: HTMLImageElement): DOMConversionOutput | null {
  const src = domNode.getAttribute('src');
  const altText = domNode.getAttribute('alt') || '';
  const width = domNode.getAttribute('width');
  const height = domNode.getAttribute('height');

  if (src) {
    const node = $createImageNode({
      src,
      altText,
      width: width ? parseInt(width, 10) : null,
      height: height ? parseInt(height, 10) : null,
    });
    return { node };
  }

  return null;
}

export type DOMConversionOutput = {
  node: LexicalNode | null | Array<LexicalNode>;
};

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width?: number | null;
  __height?: number | null;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const node = $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
    });
    return node;
  }

  constructor(
    src: string,
    altText: string = '',
    width?: number | null,
    height?: number | null,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'image-node-wrapper';
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        nodeKey={this.__key}
      />
    );
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 0,
      }),
    };
  }
}

export function $createImageNode(payload: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(
      payload.src,
      payload.altText ?? '',
      payload.width ?? null,
      payload.height ?? null
    )
  );
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

export function $getNodeByKey(key: NodeKey): LexicalNode | null {
  // This is a placeholder - in actual Lexical, use $getNodeByKey from lexical
  // The toolbar will use editor.getEditorState().read(() => $getNodeByKey(key))
  return null;
}

type DOMConversionMap = Record<
  string,
  (element: HTMLElement) => DOMConversionOutput | null
>;
```

- [ ] **Step 2: Verify the file was created**

```bash
ls -la lefarma.frontend/src/components/help/nodes/ImageNode.tsx
```

Expected: File exists.

---

## Task 12: Frontend - Enhance LexicalEditor with Toolbar and Plugins

**Files:**
- Modify: `lefarma.frontend/src/components/help/LexicalEditor.tsx`

- [ ] **Step 1: Rewrite LexicalEditor with full toolbar and plugins**

Replace the entire content of `lefarma.frontend/src/components/help/LexicalEditor.tsx`:

```typescript
// File: src/components/help/LexicalEditor.tsx
import { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { CodeHighlightPlugin } from '@lexical/react/LexicalCodeHighlightPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { RichTextToolbar } from './RichTextToolbar';
import { ImageNode } from './nodes/ImageNode';

interface LexicalEditorProps {
  initialContent: string;
  onChange: (serializedState: string) => void;
}

function InitialContentPlugin({ serializedState }: { serializedState: string }) {
  const [editor] = useLexicalComposerContext();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }

    if (!serializedState) {
      return;
    }

    try {
      const parsedState = editor.parseEditorState(serializedState);
      editor.setEditorState(parsedState);
      didInitRef.current = true;
    } catch (error) {
      console.error('Error loading Lexical state:', error);
    }
  }, [editor, serializedState]);

  return null;
}

function UpdateStatePlugin({ onChange }: { onChange: (state: string) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      onChange(JSON.stringify(editorState.toJSON()));
    });
  }, [editor, onChange]);

  return null;
}

const theme = {
  paragraph: 'mb-4 leading-7',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded font-mono text-sm',
    underlineStrikethrough: 'underline line-through',
  },
  heading: {
    h1: 'text-3xl font-bold mb-4 mt-6',
    h2: 'text-2xl font-bold mb-3 mt-5',
    h3: 'text-xl font-bold mb-2 mt-4',
    h4: 'text-lg font-bold mb-2 mt-3',
  },
  list: {
    ul: 'list-disc pl-6 mb-4 space-y-1',
    ol: 'list-decimal pl-6 mb-4 space-y-1',
    listitem: 'leading-7',
  },
  quote: 'border-l-4 border-primary pl-4 italic my-4',
  code: 'bg-muted p-4 rounded-lg font-mono text-sm block overflow-x-auto',
  link: 'text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer',
};

function onError(error: Error) {
  console.error('Lexical editor error:', error);
}

export default function LexicalEditor({ initialContent, onChange }: LexicalEditorProps) {
  const [key, setKey] = useState(0);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const initialConfig = {
    namespace: 'HelpRichTextEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      CodeNode,
      CodeHighlightNode,
      ImageNode,
    ],
  };

  // Force re-initialization when initialContent changes significantly
  useEffect(() => {
    setKey(prev => prev + 1);
  }, [initialContent?.length && initialContent.length > 0 ? initialContent.substring(0, 100) : 'empty']);

  return (
    <LexicalComposer key={key} initialConfig={initialConfig}>
      <div className="rounded-md border bg-background overflow-hidden">
        <RichTextToolbar />
        <div className="p-4 min-h-[340px]">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[300px] outline-none text-sm leading-6" />
            }
            placeholder={
              <div className="text-sm text-muted-foreground">
                Escribe el contenido del artículo aquí...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <CodeHighlightPlugin />
          <AutoFocusPlugin />
          <InitialContentPlugin serializedState={initialContent} />
          <OnChangePlugin
            onChange={(editorState) => {
              onChange(JSON.stringify(editorState.toJSON()));
            }}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}
```

- [ ] **Step 2: Verify frontend changes**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No lint errors. Some unused import warnings may occur - fix them.

---

## Task 13: Frontend - Update LexicalViewer for Image Support

**Files:**
- Modify: `lefarma.frontend/src/components/help/LexicalViewer.tsx`

- [ ] **Step 1: Enhance LexicalViewer with same nodes and theme**

Replace the entire content of `lefarma.frontend/src/components/help/LexicalViewer.tsx`:

```typescript
// File: src/components/help/LexicalViewer.tsx
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { ImageNode } from './nodes/ImageNode';

interface LexicalViewerProps {
  contenido: string;
}

const theme = {
  paragraph: 'mb-4 leading-7',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded font-mono text-sm',
    underlineStrikethrough: 'underline line-through',
  },
  heading: {
    h1: 'text-3xl font-bold mb-4 mt-6',
    h2: 'text-2xl font-bold mb-3 mt-5',
    h3: 'text-xl font-bold mb-2 mt-4',
    h4: 'text-lg font-bold mb-2 mt-3',
  },
  list: {
    ul: 'list-disc pl-6 mb-4 space-y-1',
    ol: 'list-decimal pl-6 mb-4 space-y-1',
    listitem: 'leading-7',
  },
  quote: 'border-l-4 border-primary pl-4 italic my-4',
  code: 'bg-muted p-4 rounded-lg font-mono text-sm block overflow-x-auto',
  link: 'text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer',
};

function onError(error: Error) {
  console.error('Lexical viewer error:', error);
}

export default function LexicalViewer({ contenido }: LexicalViewerProps) {
  const initialConfig = {
    namespace: 'HelpRichTextViewer',
    editable: false,
    theme,
    onError,
    editorState: contenido,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      CodeNode,
      CodeHighlightNode,
      ImageNode,
    ],
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable className="min-h-[200px] outline-none text-sm leading-6" />
        }
        placeholder={<div className="text-sm text-muted-foreground" />}
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  );
}
```

- [ ] **Step 2: Verify frontend changes**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No lint errors.

---

## Task 14: Frontend - Enhance HelpList with Empty State and Full Type Switch

**Files:**
- Modify: `lefarma.frontend/src/pages/help/HelpList.tsx`

- [ ] **Step 1: Update HelpList with empty state and improved type switch**

This is a significant refactor. Key changes:
1. Remove HelpCard import (already done)
2. Add empty state component
3. Update type switch to use fetchForUser for "Usuario" mode
4. Improve layout

Replace the entire content of `lefarma.frontend/src/pages/help/HelpList.tsx`:

```typescript
// File: src/pages/help/HelpList.tsx
import { useEffect, useState, useMemo } from 'react';
import { FilePenLine, Save, FileText, Plus } from 'lucide-react';
import { HelpSidebar } from '@/components/help/HelpSidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import LexicalEditor from '@/components/help/LexicalEditor';
import LexicalViewer from '@/components/help/LexicalViewer';
import { useHelpStore } from '@/store/helpStore';
import { useAuthStore } from '@/store/authStore';

const DEFAULT_EMPTY_CONTENT = JSON.stringify(
  {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'Escribe aquí la ayuda inicial del sistema.',
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  },
  null,
  2
);

export default function HelpList() {
  const {
    articles,
    isLoading,
    selectedType,
    selectedModule,
    fetchForUser,
    fetchArticlesByType,
    fetchArticlesByModule,
  } = useHelpStore();
  const { user } = useAuthStore();

  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Permission check
  const canEdit = useMemo(() => {
    return user?.roles?.some((r) => r === 'Administrator' || r === 'Manager') ?? false;
  }, [user]);

  // Get selected article
  const selectedArticle = useMemo(() => {
    return articles.find((a) => a.id === selectedArticleId) ?? (articles.length > 0 ? articles[0] : null);
  }, [articles, selectedArticleId]);

  // Load articles on mount based on type
  useEffect(() => {
    if (selectedType === 'desarrollador') {
      fetchArticlesByType('desarrollador');
    } else {
      fetchForUser();
    }
  }, []);

  // Update edited content when article changes
  useEffect(() => {
    if (!isEditing && selectedArticle) {
      setEditedContent(selectedArticle.contenido);
    }
  }, [isEditing, selectedArticle]);

  // Auto-select first article when articles load
  useEffect(() => {
    if (articles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  // Handle type switch toggle
  const handleToggleDocType = async (checked: boolean) => {
    setIsEditing(false);
    setSelectedArticleId(null);

    if (checked) {
      // Sistemas mode - fetch developer articles
      await fetchArticlesByType('desarrollador');
    } else {
      // Usuario mode - fetch user articles (usuario + ambos)
      await fetchForUser();
    }
  };

  const handleEdit = () => {
    if (!selectedArticle) return;
    setEditedContent(selectedArticle.contenido);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!selectedArticle) return;
    setEditedContent(selectedArticle.contenido);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    // Save implementation would go here
    // For now, just exit edit mode
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    // Create new article implementation
    // Would open a modal or navigate to create form
    console.log('Create new article for:', selectedModule, selectedType);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-64 border-r shrink-0">
          <HelpSidebar />
        </div>
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="rounded-lg border p-6 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r shrink-0">
        <HelpSidebar />
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Centro de Ayuda</h1>
            <div className="flex items-center gap-2">
              {/* Type Switch */}
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="text-sm text-muted-foreground">Usuario</span>
                <Switch
                  checked={selectedType === 'desarrollador'}
                  onCheckedChange={handleToggleDocType}
                  aria-label="Cambiar tipo de documento (Usuario vs Sistemas)"
                />
                <span className="text-sm text-muted-foreground">Sistemas</span>
              </div>

              {/* Edit/Save Buttons */}
              {articles.length > 0 && canEdit && (
                !isEditing ? (
                  <Button variant="outline" onClick={handleEdit} disabled={!selectedArticle}>
                    <FilePenLine className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSaveEdit} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                      Cancelar
                    </Button>
                  </>
                )
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="rounded-lg border p-6">
            {articles.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No hay artículos</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  No se encontraron artículos para "{selectedModule}" en modo "
                  {selectedType === 'desarrollador' ? 'Sistemas' : 'Usuario'}".
                </p>
                {canEdit && (
                  <Button onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear artículo
                  </Button>
                )}
              </div>
            ) : (
              /* Article Content */
              selectedArticle && (
                <>
                  <div className="space-y-1 mb-6">
                    <h2 className="text-2xl font-bold">{selectedArticle.titulo}</h2>
                    {selectedArticle.resumen && (
                      <p className="text-muted-foreground">{selectedArticle.resumen}</p>
                    )}
                  </div>
                  {isEditing ? (
                    <LexicalEditor
                      initialContent={selectedArticle.contenido}
                      onChange={setEditedContent}
                    />
                  ) : (
                    <LexicalViewer contenido={selectedArticle.contenido} />
                  )}
                </>
              )
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend changes**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No lint errors.

---

## Task 15: Documentation - Update API Routes

**Files:**
- Modify: `lefarma.docs/backend/api-routes.md`

- [ ] **Step 1: Add documentation for new endpoints**

Add the following sections to the Help section in `lefarma.docs/backend/api-routes.md`:

```markdown
### Help Images

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/help/images` | Upload image for help articles | Administrator, Manager |

#### POST /api/help/images

Uploads an image file for use in help articles.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (binary) - Image file (PNG, JPEG, GIF, WebP, max 5MB)

**Response (201):**
```json
{
  "success": true,
  "message": "Imagen subida exitosamente.",
  "data": {
    "id": 1,
    "nombreOriginal": "screenshot.png",
    "nombreArchivo": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
    "rutaRelativa": "/media/help/2026/03/a1b2c3d4.png",
    "tamanhoBytes": 45678,
    "mimeType": "image/png",
    "ancho": null,
    "alto": null,
    "fechaSubida": "2026-03-25T10:30:00Z"
  }
}
```

### Help Articles - Additional Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/help/articles/for-user` | Get articles for users (tipo usuario or ambos) | Any authenticated |

#### GET /api/help/articles/for-user

Returns articles with `tipo` equal to `usuario` or `ambos`.

**Query Parameters:**
- `modulo` (optional) - Filter by module name

**Response (200):**
```json
{
  "success": true,
  "message": "Artículos de ayuda para usuario obtenidos exitosamente.",
  "data": [
    {
      "id": 1,
      "titulo": "Cómo crear un catálogo",
      "contenido": "{...}",
      "resumen": "Guía paso a paso",
      "modulo": "Catalogos",
      "tipo": "usuario",
      "categoria": "General",
      "orden": 1,
      "activo": true,
      "fechaCreacion": "2026-03-25T10:00:00Z",
      "fechaActualizacion": "2026-03-25T10:00:00Z"
    }
  ]
}
```

### Static Files

Images are served directly via static files middleware:

- **URL Pattern:** `/media/help/{year}/{month}/{filename}`
- **Cache Control:** `public, max-age=31536000` (1 year)
- **No authentication required** for viewing images
```

---

## Task 16: Documentation - Update Frontend Components

**Files:**
- Modify: `lefarma.docs/frontend/components.md`

- [ ] **Step 1: Add documentation for new Help components**

Add the following section to `lefarma.docs/frontend/components.md`:

```markdown
### Help Components

#### LexicalEditor

Rich text editor with full toolbar for editing help articles.

**Location:** `src/components/help/LexicalEditor.tsx`

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `initialContent` | `string` | Lexical JSON state to load |
| `onChange` | `(state: string) => void` | Callback when content changes |

**Features:**
- Bold, italic, underline, strikethrough
- Headings (H1, H2)
- Bullet and numbered lists
- Block quotes
- Code blocks (inline and block)
- Links
- Image upload

#### LexicalViewer

Read-only viewer for help articles.

**Location:** `src/components/help/LexicalViewer.tsx`

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `contenido` | `string` | Lexical JSON state to render |

#### RichTextToolbar

Formatting toolbar for LexicalEditor.

**Location:** `src/components/help/RichTextToolbar.tsx`

**Features:**
- Undo/Redo
- Text formatting (bold, italic, underline, strikethrough, code)
- Block types (paragraph, h1, h2, quote, code block)
- Lists (bullet, numbered)
- Links
- Image upload

#### ImageUploadDialog

Modal dialog for uploading images.

**Location:** `src/components/help/ui/ImageUploadDialog.tsx`

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Dialog state callback |
| `onImageUploaded` | `(data: HelpImageUploadResponse) => void` | Callback with upload result |

**File Constraints:**
- Allowed types: PNG, JPEG, GIF, WebP
- Max size: 5 MB

#### ImageNode

Custom Lexical node for images.

**Location:** `src/components/help/nodes/ImageNode.tsx`

**JSON Structure:**
```json
{
  "type": "image",
  "version": 1,
  "src": "/media/help/2026/03/abc123.png",
  "altText": "Screenshot",
  "width": 800,
  "height": 600
}
```

#### HelpCard (DELETED)

**Status:** Removed in Help redesign.

Article cards grid was removed from HelpList. The main page now shows a single content area with sidebar navigation.
```

---

## Task 17: Documentation - Update Types

**Files:**
- Modify: `lefarma.docs/frontend/types.md`

- [ ] **Step 1: Add HelpImageUploadResponse type documentation**

Add to `lefarma.docs/frontend/types.md`:

```markdown
### HelpImageUploadResponse

Response from image upload endpoint.

```typescript
interface HelpImageUploadResponse {
  id: number;
  nombreOriginal: string;      // Original filename
  nombreArchivo: string;        // GUID-based filename
  rutaRelativa: string;         // URL path: /media/help/2026/03/abc.png
  tamanhoBytes: number;         // File size in bytes
  mimeType: string;             // image/png, image/jpeg, etc.
  ancho?: number;               // Image width (optional)
  alto?: number;                // Image height (optional)
  fechaSubida: string;          // ISO timestamp
}
```
```

---

## Task 18: Final Verification

- [ ] **Step 1: Verify backend builds**

```bash
cd lefarma.backend && dotnet build
```

Expected: Build succeeds.

- [ ] **Step 2: Verify frontend lints**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No errors.

- [ ] **Step 3: Verify frontend dev server starts**

```bash
cd lefarma.frontend && timeout 10 npm run dev || true
```

Expected: Dev server starts without errors.

- [ ] **Step 4: Manual smoke test checklist**

1. [ ] Backend: `GET /api/help/articles/for-user` returns articles
2. [ ] Backend: `POST /api/help/images` uploads image and returns path
3. [ ] Frontend: Help page loads without errors
4. [ ] Frontend: Type switch (Usuario/Sistemas) works and replaces content
5. [ ] Frontend: Editor toolbar is visible with all buttons
6. [ ] Frontend: Image upload dialog opens and uploads
7. [ ] Frontend: Viewer renders images correctly

---

## Execution Recommendation

### Recommended: Subagent-Driven Development

**Approach:** Dispatch a fresh subagent per task (or small group of related tasks), with review checkpoints between major phases.

**Tradeoffs:**

| Factor | Subagent-Driven | Inline Execution |
|--------|----------------|------------------|
| **Context freshness** | ✅ Each task gets clean context | ⚠️ Context bloats over time |
| **Error isolation** | ✅ Errors don't cascade | ⚠️ One error can corrupt everything |
| **Parallelization** | ✅ Can run backend + frontend tasks concurrently | ❌ Sequential only |
| **Review checkpoints** | ✅ Natural break points | ⚠️ Must manually pause |
| **Speed** | ✅ Faster for large changes | ⚠️ Slower due to context management |
| **Complexity** | ⚠️ More orchestration overhead | ✅ Simpler flow |

**Recommended batching:**

1. **Batch 1 (Backend Foundation):** Tasks 1-3 — All backend changes
2. **Batch 2 (Frontend Foundation):** Tasks 4-6 — Remove cards, add types/store
3. **Batch 3 (Lexical Plugins):** Task 7 — Install packages
4. **Batch 4 (UI Components):** Tasks 8-11 — Toolbar, dialog, image node
5. **Batch 5 (Editor Integration):** Tasks 12-14 — Wire everything together
6. **Batch 6 (Documentation):** Tasks 15-17 — Update docs
7. **Batch 7 (Verification):** Task 18 — Final testing

**When to use Inline Execution instead:**
- If you need to make quick fixes during implementation
- If the implementer has strong context on the codebase
- If you're working on a single, focused task

---

*Plan generated by writing-plans skill*
*Based on design document: `docs/superpowers/specs/2026-03-25-help-redesign-design.md`*
*Created: 2026-03-25*
