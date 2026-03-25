# Help & Support System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a documentation system with Lexical rich text editor, image upload, and module-based organization for both end-users and developers.

**Architecture:** .NET backend (Service + Repository pattern) with SQL Server storage, React frontend with Lexical editor, following established Lefarma patterns (ApiResponse<T>, FluentValidation, Zustand state).

**Tech Stack:** Backend (.NET 10, EF Core, FluentValidation), Frontend (React 19, Lexical, Zustand, shadcn/ui), Database (SQL Server, [help] schema).

---

## File Structure

**Backend (New Files):**
```
lefarma.backend/src/Lefarma.API/
├── Features/Help/
│   ├── Controllers/HelpArticlesController.cs
│   ├── Services/IHelpArticleService.cs
│   ├── Services/HelpArticleService.cs
│   ├── DTOs/HelpArticleDto.cs
│   ├── DTOs/CreateHelpArticleRequest.cs
│   ├── DTOs/UpdateHelpArticleRequest.cs
│   └── Validators/CreateHelpArticleValidator.cs
├── Domain/Entities/HelpArticle.cs
├── Infrastructure/Data/Configurations/HelpArticleConfiguration.cs
├── Infrastructure/Data/Repositories/HelpArticleRepository.cs
└── Services/FileStorageService.cs (placeholder for future image upload)
```

**Frontend (New Files):**
```
lefarma.frontend/src/
├── pages/help/
│   ├── HelpList.tsx
│   ├── HelpView.tsx
│   └── HelpEditor.tsx
├── components/help/
│   ├── HelpSidebar.tsx
│   ├── HelpCard.tsx
│   ├── LexicalEditor.tsx
│   └── ImageUploader.tsx
├── services/helpService.ts
└── types/help.types.ts
```

---

## Task 1: Database Schema & EF Configuration

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Database/HelpSystem.sql` ✅ (already created)
- Modify: `lefarma.backend/src/Lefarma.API/Domain/Entities/HelpArticle.cs`
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/HelpArticleConfiguration.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`

- [ ] **Step 1: Run SQL script to create tables**

```bash
cd lefarma.backend/src/Lefarma.API
sqlcmd -S localhost -d Lefarma -i Database/HelpSystem.sql
# OR use SSMS to execute the script
```

Expected: Tables [help].HelpArticles and [help].HelpImages created

- [ ] **Step 2: Create HelpArticle entity**

Create: `lefarma.backend/src/Lefarma.API/Domain/Entities/HelpArticle.cs`

```csharp
namespace Lefarma.API.Domain.Entities;

public class HelpArticle
{
    public int Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Contenido { get; set; } = string.Empty; // Lexical JSON
    public string? Resumen { get; set; }
    public string Modulo { get; set; } = string.Empty; // 'Catalogos', 'Auth', etc.
    public string Tipo { get; set; } = string.Empty; // 'usuario', 'desarrollador', 'ambos'
    public string? Categoria { get; set; }
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
    public string? CreadoPor { get; set; }
    public string? ActualizadoPor { get; set; }
}
```

- [ ] **Step 3: Create EF configuration**

Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/HelpArticleConfiguration.cs`

```csharp
using Lefarma.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations;

public class HelpArticleConfiguration : IEntityTypeConfiguration<HelpArticle>
{
    public void Configure(EntityTypeBuilder<HelpArticle> builder)
    {
        builder.ToTable("HelpArticles", schema: "help");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Titulo)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Contenido)
            .IsRequired();

        builder.Property(x => x.Resumen)
            .HasMaxLength(500);

        builder.Property(x => x.Modulo)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Tipo)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Categoria)
            .HasMaxLength(100);

        builder.Property(x => x.CreadoPor)
            .HasMaxLength(100);

        builder.Property(x => x.ActualizadoPor)
            .HasMaxLength(100);

        builder.HasIndex(x => new { x.Modulo, x.Activo });
        builder.HasIndex(x => new { x.Tipo, x.Activo });
        builder.HasIndex(x => x.Categoria);
    }
}
```

- [ ] **Step 4: Update ApplicationDbContext**

Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`

Add to OnModelCreating:
```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // ... existing configurations ...

    modelBuilder.ApplyConfiguration(new HelpArticleConfiguration());

    // ...
}
```

Add DbSet:
```csharp
public DbSet<HelpArticle> HelpArticles => Set<HelpArticle>();
```

- [ ] **Step 5: Create migration**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet ef migrations add AddHelpSystem
```

Expected: Migration file created with HelpArticle table

- [ ] **Step 6: Apply migration**

```bash
dotnet ef database update
```

Expected: Database updated successfully

- [ ] **Step 7: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/
git commit -m "feat(help): add database schema and entity configuration"
```

---

## Task 2: Backend DTOs and Validators

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/HelpArticleDto.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/CreateHelpArticleRequest.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/UpdateHelpArticleRequest.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Validators/CreateHelpArticleValidator.cs`

- [ ] **Step 1: Create HelpArticleDto**

Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/HelpArticleDto.cs`

```csharp
namespace Lefarma.API.Features.Help.DTOs;

public record HelpArticleDto
{
    public int Id { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public string Contenido { get; init; } = string.Empty;
    public string? Resumen { get; init; }
    public string Modulo { get; init; } = string.Empty;
    public string Tipo { get; init; } = string.Empty;
    public string? Categoria { get; init; }
    public int Orden { get; init; }
    public bool Activo { get; init; }
    public DateTime FechaCreacion { get; init; }
    public DateTime FechaActualizacion { get; init; }
    public string? CreadoPor { get; init; }
    public string? ActualizadoPor { get; init; }
}
```

- [ ] **Step 2: Create CreateHelpArticleRequest**

Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/CreateHelpArticleRequest.cs`

```csharp
using FluentValidation;
using Lefarma.API.Shared.Constants;

namespace Lefarma.API.Features.Help.DTOs;

public record CreateHelpArticleRequest
{
    public string Titulo { get; init; } = string.Empty;
    public string Contenido { get; init; } = string.Empty;
    public string? Resumen { get; init; }
    public string Modulo { get; init; } = string.Empty;
    public string Tipo { get; init; } = string.Empty;
    public string? Categoria { get; init; }
    public int Orden { get; init; }
}

public class CreateHelpArticleValidator : AbstractValidator<CreateHelpArticleRequest>
{
    public CreateHelpArticleValidator()
    {
        RuleFor(x => x.Titulo)
            .NotEmpty().WithMessage("El título es requerido")
            .MaximumLength(200).WithMessage("El título no puede exceder 200 caracteres");

        RuleFor(x => x.Contenido)
            .NotEmpty().WithMessage("El contenido es requerido");

        RuleFor(x => x.Resumen)
            .MaximumLength(500).WithMessage("El resumen no puede exceder 500 caracteres");

        RuleFor(x => x.Modulo)
            .NotEmpty().WithMessage("El módulo es requerido")
            .Must(BeValidModule).WithMessage("Módulo no válido");

        RuleFor(x => x.Tipo)
            .NotEmpty().WithMessage("El tipo es requerido")
            .Must(BeValidType).WithMessage("Tipo debe ser: usuario, desarrollador o ambos");
    }

    private bool BeValidModule(string modulo)
    {
        var validModules = new[] { "Catalogos", "Auth", "Notificaciones", "Profile", "Admin", "SystemConfig", "General" };
        return validModules.Contains(modulo);
    }

    private bool BeValidType(string tipo)
    {
        var validTypes = new[] { "usuario", "desarrollador", "ambos" };
        return validTypes.Contains(tipo);
    }
}
```

- [ ] **Step 3: Create UpdateHelpArticleRequest**

Create: `lefarma.backend/src/Lefarma.API/Features/Help/DTOs/UpdateHelpArticleRequest.cs`

```csharp
using FluentValidation;
using Lefarma.API.Shared.Constants;

namespace Lefarma.API.Features.Help.DTOs;

public record UpdateHelpArticleRequest
{
    public int Id { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public string Contenido { get; init; } = string.Empty;
    public string? Resumen { get; init; }
    public string Modulo { get; init; } = string.Empty;
    public string Tipo { get; init; } = string.Empty;
    public string? Categoria { get; init; }
    public int Orden { get; init; }
    public bool Activo { get; init; }
}

public class UpdateHelpArticleValidator : AbstractValidator<UpdateHelpArticleRequest>
{
    public UpdateHelpArticleValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithMessage("ID inválido");

        RuleFor(x => x.Titulo)
            .NotEmpty().WithMessage("El título es requerido")
            .MaximumLength(200).WithMessage("El título no puede exceder 200 caracteres");

        RuleFor(x => x.Contenido)
            .NotEmpty().WithMessage("El contenido es requerido");

        RuleFor(x => x.Resumen)
            .MaximumLength(500).WithMessage("El resumen no puede exceder 500 caracteres");

        RuleFor(x => x.Modulo)
            .NotEmpty().WithMessage("El módulo es requerido")
            .Must(BeValidModule).WithMessage("Módulo no válido");

        RuleFor(x => x.Tipo)
            .NotEmpty().WithMessage("El tipo es requerido")
            .Must(BeValidType).WithMessage("Tipo debe ser: usuario, desarrollador o ambos");
    }

    private bool BeValidModule(string modulo)
    {
        var validModules = new[] { "Catalogos", "Auth", "Notificaciones", "Profile", "Admin", "SystemConfig", "General" };
        return validModules.Contains(modulo);
    }

    private bool BeValidType(string tipo)
    {
        var validTypes = new[] { "usuario", "desarrollador", "ambos" };
        return validTypes.Contains(tipo);
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Help/
git commit -m "feat(help): add DTOs and validators"
```

---

## Task 3: Repository Pattern

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/IHelpArticleRepository.cs`
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/HelpArticleRepository.cs`

- [ ] **Step 1: Create interface**

Create: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/IHelpArticleRepository.cs`

```csharp
using Lefarma.API.Domain.Entities;

namespace Lefarma.API.Domain.Interfaces;

public interface IHelpArticleRepository
{
    Task<IEnumerable<HelpArticle>> GetAllAsync(CancellationToken ct);
    Task<IEnumerable<HelpArticle>> GetByModuleAsync(string modulo, CancellationToken ct);
    Task<IEnumerable<HelpArticle>> GetByTypeAsync(string tipo, CancellationToken ct);
    Task<HelpArticle?> GetByIdAsync(int id, CancellationToken ct);
    Task<HelpArticle> CreateAsync(HelpArticle article, CancellationToken ct);
    Task<HelpArticle> UpdateAsync(HelpArticle article, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}
```

- [ ] **Step 2: Create repository implementation**

Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/HelpArticleRepository.cs`

```csharp
using Lefarma.API.Domain.Entities;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;

public class HelpArticleRepository : IHelpArticleRepository
{
    private readonly ApplicationDbContext _context;

    public HelpArticleRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<HelpArticle>> GetAllAsync(CancellationToken ct)
    {
        return await _context.HelpArticles
            .Where(x => x.Activo)
            .OrderBy(x => x.Modulo)
            .ThenBy(x => x.Orden)
            .ToListAsync(ct);
    }

    public async Task<IEnumerable<HelpArticle>> GetByModuleAsync(string modulo, CancellationToken ct)
    {
        return await _context.HelpArticles
            .Where(x => x.Modulo == modulo && x.Activo)
            .OrderBy(x => x.Orden)
            .ToListAsync(ct);
    }

    public async Task<IEnumerable<HelpArticle>> GetByTypeAsync(string tipo, CancellationToken ct)
    {
        return await _context.HelpArticles
            .Where(x => x.Tipo == tipo && x.Activo)
            .OrderBy(x => x.Modulo)
            .ThenBy(x => x.Orden)
            .ToListAsync(ct);
    }

    public async Task<HelpArticle?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _context.HelpArticles
            .FirstOrDefaultAsync(x => x.Id == id, ct);
    }

    public async Task<HelpArticle> CreateAsync(HelpArticle article, CancellationToken ct)
    {
        article.FechaCreacion = DateTime.UtcNow;
        article.FechaActualizacion = DateTime.UtcNow;

        _context.HelpArticles.Add(article);
        await _context.SaveChangesAsync(ct);

        return article;
    }

    public async Task<HelpArticle> UpdateAsync(HelpArticle article, CancellationToken ct)
    {
        article.FechaActualizacion = DateTime.UtcNow;

        _context.HelpArticles.Update(article);
        await _context.SaveChangesAsync(ct);

        return article;
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var article = await _context.HelpArticles
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (article != null)
        {
            article.Activo = false;
            await _context.SaveChangesAsync(ct);
        }
    }
}
```

- [ ] **Step 3: Register in Program.cs**

Modify: `lefarma.backend/src/Lefarma.API/Program.cs`

Add to service registration:
```csharp
builder.Services.AddScoped<IHelpArticleRepository, HelpArticleRepository>();
```

- [ ] **Step 4: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/
git commit -m "feat(help): add repository implementation"
```

---

## Task 4: Service Layer

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Services/IHelpArticleService.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Services/HelpArticleService.cs`

- [ ] **Step 1: Create service interface**

Create: `lefarma.backend/src/Lefarma.API/Features/Help/Services/IHelpArticleService.cs`

```csharp
using Lefarma.API.Features.Help.DTOs;
using ErrorOr;

namespace Lefarma.API.Features.Help.Services;

public interface IHelpArticleService
{
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetAllAsync(CancellationToken ct);
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByModuleAsync(string modulo, CancellationToken ct);
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByTypeAsync(string tipo, CancellationToken ct);
    Task<ErrorOr<HelpArticleDto>> GetByIdAsync(int id, CancellationToken ct);
    Task<ErrorOr<HelpArticleDto>> CreateAsync(CreateHelpArticleRequest request, string createdBy, CancellationToken ct);
    Task<ErrorOr<HelpArticleDto>> UpdateAsync(UpdateHelpArticleRequest request, string updatedBy, CancellationToken ct);
    Task<ErrorOr<Success>> DeleteAsync(int id, CancellationToken ct);
}
```

- [ ] **Step 2: Create service implementation**

Create: `lefarma.backend/src/Lefarma.API/Features/Help/Services/HelpArticleService.cs`

```csharp
using Lefarma.API.Domain.Entities;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Shared.Errors;
using ErrorOr;

namespace Lefarma.API.Features.Help.Services;

public class HelpArticleService : IHelpArticleService
{
    private readonly IHelpArticleRepository _repository;

    public HelpArticleService(IHelpArticleRepository repository)
    {
        _repository = repository;
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetAllAsync(CancellationToken ct)
    {
        var articles = await _repository.GetAllAsync(ct);
        return articles.Select(MapToDto);
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByModuleAsync(string modulo, CancellationToken ct)
    {
        var articles = await _repository.GetByModuleAsync(modulo, ct);
        return articles.Select(MapToDto);
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByTypeAsync(string tipo, CancellationToken ct)
    {
        var articles = await _repository.GetByTypeAsync(tipo, ct);
        return articles.Select(MapToDto);
    }

    public async Task<ErrorOr<HelpArticleDto>> GetByIdAsync(int id, CancellationToken ct)
    {
        var article = await _repository.GetByIdAsync(id, ct);

        if (article == null)
            return Errors.HelpArticle.NotFound;

        return MapToDto(article);
    }

    public async Task<ErrorOr<HelpArticleDto>> CreateAsync(CreateHelpArticleRequest request, string createdBy, CancellationToken ct)
    {
        var article = new HelpArticle
        {
            Titulo = request.Titulo,
            Contenido = request.Contenido,
            Resumen = request.Resumen,
            Modulo = request.Modulo,
            Tipo = request.Tipo,
            Categoria = request.Categoria,
            Orden = request.Orden,
            CreadoPor = createdBy
        };

        article = await _repository.CreateAsync(article, ct);

        return MapToDto(article);
    }

    public async Task<ErrorOr<HelpArticleDto>> UpdateAsync(UpdateHelpArticleRequest request, string updatedBy, CancellationToken ct)
    {
        var article = await _repository.GetByIdAsync(request.Id, ct);

        if (article == null)
            return Errors.HelpArticle.NotFound;

        article.Titulo = request.Titulo;
        article.Contenido = request.Contenido;
        article.Resumen = request.Resumen;
        article.Modulo = request.Modulo;
        article.Tipo = request.Tipo;
        article.Categoria = request.Categoria;
        article.Orden = request.Orden;
        article.Activo = request.Activo;
        article.ActualizadoPor = updatedBy;

        article = await _repository.UpdateAsync(article, ct);

        return MapToDto(article);
    }

    public async Task<ErrorOr<Success>> DeleteAsync(int id, CancellationToken ct)
    {
        var article = await _repository.GetByIdAsync(id, ct);

        if (article == null)
            return Errors.HelpArticle.NotFound;

        await _repository.DeleteAsync(id, ct);

        return Result.Success;
    }

    private static HelpArticleDto MapToDto(HelpArticle article) => new()
    {
        Id = article.Id,
        Titulo = article.Titulo,
        Contenido = article.Contenido,
        Resumen = article.Resumen,
        Modulo = article.Modulo,
        Tipo = article.Tipo,
        Categoria = article.Categoria,
        Orden = article.Orden,
        Activo = article.Activo,
        FechaCreacion = article.FechaCreacion,
        FechaActualizacion = article.FechaActualizacion,
        CreadoPor = article.CreadoPor,
        ActualizadoPor = article.ActualizadoPor
    };
}
```

- [ ] **Step 3: Create error definitions**

Create: `lefarma.backend/src/Lefarma.API/Shared/Errors/HelpArticleErrors.cs`

```csharp
using Lefarma.API.Shared.Errors;

namespace Lefarma.API.Shared.Errors;

public static partial class Errors
{
    public static class HelpArticle
    {
        public static readonly Error NotFound = Error.NotFound(
            code: "HelpArticle.NotFound",
            description: "El artículo de ayuda no existe"
        );
    }
}
```

- [ ] **Step 4: Register service**

Modify: `lefarma.backend/src/Lefarma.API/Program.cs`

Add:
```csharp
builder.Services.AddScoped<IHelpArticleService, HelpArticleService>();
```

- [ ] **Step 5: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/
git commit -m "feat(help): add service layer"
```

---

## Task 5: API Controller

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Help/Controllers/HelpArticlesController.cs`

- [ ] **Step 1: Create controller**

Create: `lefarma.backend/src/Lefarma.API/Features/Help/Controllers/HelpArticlesController.cs`

```csharp
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Help.Controllers;

[ApiController]
[Route("api/help/articles")]
[Authorize]
public class HelpArticlesController : ControllerBase
{
    private readonly IHelpArticleService _service;

    public HelpArticlesController(IHelpArticleService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await _service.GetAllAsync(ct);
        return result.ToActionResult();
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result.ToActionResult();
    }

    [HttpGet("by-module/{modulo}")]
    public async Task<IActionResult> GetByModule(string modulo, CancellationToken ct)
    {
        var result = await _service.GetByModuleAsync(modulo, ct);
        return result.ToActionResult();
    }

    [HttpGet("by-type/{tipo}")]
    public async Task<IActionResult> GetByType(string tipo, CancellationToken ct)
    {
        var result = await _service.GetByTypeAsync(tipo, ct);
        return result.ToActionResult();
    }

    [HttpPost]
    [Authorize(Roles = "Administrator,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateHelpArticleRequest request, CancellationToken ct)
    {
        var username = User.Identity?.Name ?? "unknown";
        var result = await _service.CreateAsync(request, username, ct);
        return result.ToActionResult();
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Administrator,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateHelpArticleRequest request, CancellationToken ct)
    {
        if (id != request.Id)
            return BadRequest("ID mismatch");

        var username = User.Identity?.Name ?? "unknown";
        var result = await _service.UpdateAsync(request, username, ct);
        return result.ToActionResult();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Administrator")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await _service.DeleteAsync(id, ct);
        return result.ToActionResult();
    }
}
```

- [ ] **Step 2: Build and test**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet build
```

Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/
git commit -m "feat(help): add API controller"
```

---

## Task 6: Frontend Types

**Files:**
- Create: `lefarma.frontend/src/types/help.types.ts`

- [ ] **Step 1: Create TypeScript types**

Create: `lefarma.frontend/src/types/help.types.ts`

```typescript
export interface HelpArticle {
  id: number;
  titulo: string;
  contenido: string; // Lexical JSON
  resumen?: string;
  modulo: 'Catalogos' | 'Auth' | 'Notificaciones' | 'Profile' | 'Admin' | 'SystemConfig' | 'General';
  tipo: 'usuario' | 'desarrollador' | 'ambos';
  categoria?: string;
  orden: number;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor?: string;
  actualizadoPor?: string;
}

export interface CreateHelpArticleRequest {
  titulo: string;
  contenido: string;
  resumen?: string;
  modulo: string;
  tipo: string;
  categoria?: string;
  orden: number;
}

export interface UpdateHelpArticleRequest extends CreateHelpArticleRequest {
  id: number;
  activo: boolean;
}

export interface HelpImage {
  id: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaRelativa: string;
  tamanhoBytes: number;
  mimeType: string;
  fechaSubida: string;
  subidoPor?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/types/
git commit -m "feat(help): add TypeScript types"
```

---

## Task 7: Frontend Service

**Files:**
- Create: `lefarma.frontend/src/services/helpService.ts`

- [ ] **Step 1: Create help service**

Create: `lefarma.frontend/src/services/helpService.ts`

```typescript
import api from './api';
import type { HelpArticle, CreateHelpArticleRequest, UpdateHelpArticleRequest } from '@/types/help.types';

const HELP_URL = '/api/help/articles';

export const helpService = {
  // Get all articles
  getAll: async (): Promise<HelpArticle[]> => {
    const response = await api.get<HelpArticle[]>(HELP_URL);
    return response.data;
  },

  // Get by ID
  getById: async (id: number): Promise<HelpArticle> => {
    const response = await api.get<HelpArticle>(`${HELP_URL}/${id}`);
    return response.data;
  },

  // Get by module
  getByModule: async (modulo: string): Promise<HelpArticle[]> => {
    const response = await api.get<HelpArticle[]>(`${HELP_URL}/by-module/${modulo}`);
    return response.data;
  },

  // Get by type
  getByType: async (tipo: string): Promise<HelpArticle[]> => {
    const response = await api.get<HelpArticle[]>(`${HELP_URL}/by-type/${tipo}`);
    return response.data;
  },

  // Create article
  create: async (article: CreateHelpArticleRequest): Promise<HelpArticle> => {
    const response = await api.post<HelpArticle>(HELP_URL, article);
    return response.data;
  },

  // Update article
  update: async (article: UpdateHelpArticleRequest): Promise<HelpArticle> => {
    const response = await api.put<HelpArticle>(`${HELP_URL}/${article.id}`, article);
    return response.data;
  },

  // Delete article (soft delete)
  delete: async (id: number): Promise<void> => {
    await api.delete(`${HELP_URL}/${id}`);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/services/
git commit -m "feat(help): add help service"
```

---

## Task 8: Frontend Store (Zustand)

**Files:**
- Create: `lefarma.frontend/src/store/helpStore.ts`

- [ ] **Step 1: Create help store**

Create: `lefarma.frontend/src/store/helpStore.ts`

```typescript
import { create } from 'zustand';
import type { HelpArticle } from '@/types/help.types';
import { helpService } from '@/services/helpService';

interface HelpState {
  articles: HelpArticle[];
  selectedArticle: HelpArticle | null;
  selectedModule: string;
  selectedType: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAllArticles: () => Promise<void>;
  fetchArticlesByModule: (modulo: string) => Promise<void>;
  fetchArticlesByType: (tipo: string) => Promise<void>;
  fetchArticleById: (id: number) => Promise<void>;
  setSelectedModule: (modulo: string) => void;
  setSelectedType: (tipo: string) => void;
  clearSelectedArticle: () => void;
}

export const useHelpStore = create<HelpState>((set, get) => ({
  articles: [],
  selectedArticle: null,
  selectedModule: 'General',
  selectedType: 'usuario',
  isLoading: false,
  error: null,

  fetchAllArticles: async () => {
    set({ isLoading: true, error: null });
    try {
      const articles = await helpService.getAll();
      set({ articles, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchArticlesByModule: async (modulo: string) => {
    set({ isLoading: true, error: null, selectedModule: modulo });
    try {
      const articles = await helpService.getByModule(modulo);
      set({ articles, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchArticlesByType: async (tipo: string) => {
    set({ isLoading: true, error: null, selectedType: tipo });
    try {
      const articles = await helpService.getByType(tipo);
      set({ articles, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchArticleById: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const article = await helpService.getById(id);
      set({ selectedArticle: article, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículo', isLoading: false });
    }
  },

  setSelectedModule: (modulo: string) => set({ selectedModule: modulo }),
  setSelectedType: (tipo: string) => set({ selectedType: tipo }),
  clearSelectedArticle: () => set({ selectedArticle: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add lefarma.frontend/src/store/
git commit -m "feat(help): add Zustand store"
```

---

## Task 9: Help List Page

**Files:**
- Create: `lefarma.frontend/src/pages/help/HelpList.tsx`
- Create: `lefarma.frontend/src/components/help/HelpCard.tsx`
- Create: `lefarma.frontend/src/components/help/HelpSidebar.tsx`
- Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

- [ ] **Step 1: Create HelpCard component**

Create: `lefarma.frontend/src/components/help/HelpCard.tsx`

```typescript
import { useNavigate } from 'react-router-dom';
import type { HelpArticle } from '@/types/help.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';

interface HelpCardProps {
  article: HelpArticle;
}

export function HelpCard({ article }: HelpCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/help/${article.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{article.titulo}</CardTitle>
          <Badge variant={article.tipo === 'desarrollador' ? 'default' : 'secondary'}>
            {article.tipo}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{article.resumen || 'Sin descripción'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(article.fechaActualizacion).toLocaleDateString('es-ES')}
          </div>
          {article.actualizadoPor && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {article.actualizadoPor}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create HelpSidebar component**

Create: `lefarma.frontend/src/components/help/HelpSidebar.tsx`

```typescript
import { useHelpStore } from '@/store/helpStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const MODULES = [
  { value: 'General', label: 'General' },
  { value: 'Catalogos', label: 'Catálogos' },
  { value: 'Auth', label: 'Autenticación' },
  { value: 'Notificaciones', label: 'Notificaciones' },
  { value: 'Profile', label: 'Perfil' },
  { value: 'Admin', label: 'Administración' },
  { value: 'SystemConfig', label: 'Configuración' },
];

const TYPES = [
  { value: 'usuario', label: 'Usuario Final' },
  { value: 'desarrollador', label: 'Desarrollador' },
  { value: 'ambos', label: 'Ambos' },
];

export function HelpSidebar() {
  const { selectedModule, selectedType, fetchArticlesByModule, fetchArticlesByType, fetchAllArticles } =
    useHelpStore();

  const handleModuleChange = (modulo: string) => {
    fetchArticlesByModule(modulo);
  };

  const handleTypeChange = (tipo: string) => {
    fetchArticlesByType(tipo);
  };

  const handleShowAll = () => {
    fetchAllArticles();
  };

  return (
    <div className="flex flex-col gap-4 p-4 border-r bg-background">
      <div>
        <h3 className="mb-2 font-semibold text-sm">Módulos</h3>
        <ScrollArea className="h-40">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleShowAll}
            >
              Todos los módulos
            </Button>
            {MODULES.map((modulo) => (
              <Button
                key={modulo.value}
                variant={selectedModule === modulo.value ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => handleModuleChange(modulo.value)}
              >
                {modulo.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-sm">Tipo de contenido</h3>
        <div className="flex flex-col gap-1">
          {TYPES.map((tipo) => (
            <Button
              key={tipo.value}
              variant={selectedType === tipo.value ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => handleTypeChange(tipo.value)}
            >
              {tipo.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create HelpList page**

Create: `lefarma.frontend/src/pages/help/HelpList.tsx`

```typescript
import { useEffect } from 'react';
import { useHelpStore } from '@/store/helpStore';
import { HelpCard } from '@/components/help/HelpCard';
import { HelpSidebar } from '@/components/help/HelpSidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export function HelpList() {
  const { articles, isLoading, fetchAllArticles } = useHelpStore();

  useEffect(() => {
    fetchAllArticles();
  }, [fetchAllArticles]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <HelpSidebar />

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Centro de Ayuda</h1>

          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No hay artículos disponibles</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {articles.map((article) => (
                <HelpCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 4: Add route**

Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

Add to routes:
```typescript
{
  path: '/help',
  element: <HelpList />,
},
```

- [ ] **Step 5: Update Sidebar**

Modify: `lefarma.frontend/src/components/layout/AppSidebar.tsx`

Add to menuItems:
```typescript
{
  title: 'Ayuda',
  icon: HelpCircle,
  path: '/help',
},
```

- [ ] **Step 6: Commit**

```bash
git add lefarma.frontend/src/
git commit -m "feat(help): add help list page with sidebar"
```

---

## Task 10: Help View Page

**Files:**
- Create: `lefarma.frontend/src/pages/help/HelpView.tsx`
- Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

- [ ] **Step 1: Create HelpView page**

Create: `lefarma.frontend/src/pages/help/HelpView.tsx`

```typescript
import { useEffect, useParams } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHelpStore } from '@/store/helpStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft } from 'lucide-react';

export function HelpView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedArticle, isLoading, fetchArticleById } = useHelpStore();

  useEffect(() => {
    if (id) {
      fetchArticleById(parseInt(id));
    }
  }, [id, fetchArticleById]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!selectedArticle) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-muted-foreground mb-4">Artículo no encontrado</p>
        <Button onClick={() => navigate('/help')}>Volver al centro de ayuda</Button>
      </div>
    );
  }

  // TODO: Parse and render Lexical JSON content
  // For now, show raw content in pre tag
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Button variant="ghost" onClick={() => navigate('/help')} className="mb-4">
        <ChevronLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{selectedArticle.titulo}</h1>
        <p className="text-muted-foreground">{selectedArticle.resumen}</p>
      </div>

      <div className="prose max-w-none">
        <pre className="whitespace-pre-wrap">{selectedArticle.contenido}</pre>
        <p className="text-sm text-muted-foreground mt-4">
          ℹ️ Contenido mostrado como JSON temporalmente. En la próxima versión se implementará el renderizado visual con Lexical.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route**

Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

Add:
```typescript
{
  path: '/help/:id',
  element: <HelpView />,
},
```

- [ ] **Step 3: Commit**

```bash
git add lefarma.frontend/src/
git commit -m "feat(help): add help view page"
```

---

## Task 11: Help Editor Page (Basic - Without Lexical)

**Files:**
- Create: `lefarma.frontend/src/pages/help/HelpEditor.tsx`
- Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

- [ ] **Step 1: Create HelpEditor page (basic JSON editor)**

Create: `lefarma.frontend/src/pages/help/HelpEditor.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { helpService } from '@/services/helpService';
import type { CreateHelpArticleRequest } from '@/types/help.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft } from 'lucide-react';

export function HelpEditor() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<CreateHelpArticleRequest>({
    titulo: '',
    contenido: '{}', // Default empty Lexical JSON
    resumen: '',
    modulo: 'General',
    tipo: 'usuario',
    categoria: '',
    orden: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await helpService.create(formData);
      navigate('/help');
    } catch (error) {
      console.error('Error creating article:', error);
      alert('Error al crear artículo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Button variant="ghost" onClick={() => navigate('/help')} className="mb-4">
        <ChevronLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>

      <h1 className="text-3xl font-bold mb-6">Crear Nuevo Artículo</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="titulo">Título *</Label>
          <Input
            id="titulo"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="resumen">Resumen</Label>
          <Textarea
            id="resumen"
            value={formData.resumen}
            onChange={(e) => setFormData({ ...formData, resumen: e.target.value })}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="modulo">Módulo *</Label>
            <Select value={formData.modulo} onValueChange={(value) => setFormData({ ...formData, modulo: value })}>
              <SelectTrigger id="modulo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Catalogos">Catálogos</SelectItem>
                <SelectItem value="Auth">Autenticación</SelectItem>
                <SelectItem value="Notificaciones">Notificaciones</SelectItem>
                <SelectItem value="Profile">Perfil</SelectItem>
                <SelectItem value="Admin">Administración</SelectItem>
                <SelectItem value="SystemConfig">Configuración</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tipo">Tipo *</Label>
            <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usuario">Usuario Final</SelectItem>
                <SelectItem value="desarrollador">Desarrollador</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="categoria">Categoría (opcional)</Label>
          <Input
            id="categoria"
            value={formData.categoria}
            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="orden">Orden</Label>
          <Input
            id="orden"
            type="number"
            value={formData.orden}
            onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div>
          <Label htmlFor="contenido">Contenido (Lexical JSON) *</Label>
          <Textarea
            id="contenido"
            value={formData.contenido}
            onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
            rows={10}
            className="font-mono text-sm"
            required
          />
          <p className="text-sm text-muted-foreground mt-1">
            Temporalmente editor de JSON. En próxima versión: editor visual con Lexical.
          </p>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : 'Crear Artículo'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/help')}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Add route**

Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

Add:
```typescript
{
  path: '/help/new',
  element: <HelpEditor />,
},
```

- [ ] **Step 3: Commit**

```bash
git add lefarma.frontend/src/
git commit -m "feat(help): add basic help editor (JSON input)"
```

---

## Task 12: Testing

**Files:**
- No new files, manual testing

- [ ] **Step 1: Start backend**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet run
```

Expected: API running on http://localhost:5134

- [ ] **Step 2: Start frontend**

```bash
cd lefarma.frontend
npm run dev
```

Expected: Frontend running on http://localhost:5173

- [ ] **Step 3: Test help list**

1. Navigate to http://localhost:5173/help
2. Verify sidebar shows modules
3. Verify filter by module works
4. Verify filter by type works
5. Verify loading states

- [ ] **Step 4: Test article creation**

1. Click "Nuevo Artículo" button
2. Fill form with test data
3. Submit form
4. Verify article appears in list

- [ ] **Step 5: Test article view**

1. Click on an article in the list
2. Verify article content displays
3. Verify back button works

- [ ] **Step 6: Test API endpoints**

```bash
# Test GET all
curl http://localhost:5134/api/help/articles

# Test GET by module
curl http://localhost:5134/api/help/articles/by-module/Catalogos

# Test GET by type
curl http://localhost:5134/api/help/articles/by-type/usuario
```

Expected: JSON response with articles

---

## Next Steps (Future Work)

**NOT IN SCOPE for this implementation:**

1. **Lexical Editor Integration** - Full rich text editor with image upload
   - Requires: @lexical/utils, lexical-list, lexical-link plugins
   - Image upload with drag & drop
   - Copy/paste images from clipboard

2. **Image Management** - Upload, storage, and serving
   - Backend: ImageController + FileStorageService
   - Frontend: ImageGallery component
   - Database: HelpImages table

3. **Full-Text Search** - Search across article content
   - SQL Server FULLTEXT index
   - Search API endpoint

4. **Advanced Features**
   - Version history
   - Draft/Published workflow
   - Categories with hierarchy
   - Article tags

These can be added in follow-up tasks once basic CRUD is working.

---

## Completion Criteria

✅ Database tables created and seeded
✅ Backend API fully functional (all endpoints tested)
✅ Frontend can list, view, create, and edit articles
✅ Filters by module and type work correctly
✅ Basic navigation (list → view → back) works
✅ TypeScript compilation passes
✅ No console errors in browser
✅ API returns valid JSON responses

---

## References

- Lefarma CLAUDE.md - Project patterns and conventions
- Lexical documentation: https://lexical.dev/
- EF Core Migrations: https://docs.microsoft.com/ef/core/
- Zustand store pattern: https://zustand-demo.pmnd.rs/
