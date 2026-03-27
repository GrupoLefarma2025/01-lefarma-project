# Formas de Pago Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete Forms of Payment catalog with CRUD API, database table, and React UI page following existing catalog patterns (Areas, Empresas).

**Architecture:** .NET 10 Web API backend with Entity Framework Core + React 19 frontend. Feature-based layered architecture with repository pattern. REST API endpoints returning ApiResponse<T>. Frontend uses React Hook Form + Zod validation with shadcn/ui components.

**Tech Stack:** C#/.NET 10, Entity Framework Core 10, SQL Server, React 19, TypeScript, Zod, TailwindCSS, FluentValidation, ErrorOr pattern

---

## File Structure

**Backend (9 new files):**
- `Domain/Entities/Catalogos/FormaPago.cs` - EF Core entity
- `Infrastructure/Data/Configurations/Catalogos/FormaPagoConfiguration.cs` - EF config
- `Domain/Interfaces/Catalogos/IFormaPagoRepository.cs` - Repository interface
- `Infrastructure/Data/Repositories/Catalogos/FormaPagoRepository.cs` - Repository implementation
- `Domain/Interfaces/Catalogos/IFormaPagoService.cs` - Service interface
- `Features/Catalogos/FormasPago/FormaPagoService.cs` - Business logic
- `Features/Catalogos/FormasPago/FormasPagoController.cs` - API endpoints
- `Features/Catalogos/FormasPago/FormaPagoValidator.cs` - FluentValidation
- `Features/Catalogos/FormasPago/DTOs/FormaPagoDTOs.cs` - Request/Response DTOs

**Frontend (2 new files):**
- `pages/catalogos/generales/FormasPago/FormasPagoList.tsx` - CRUD page
- Update `routes/AppRoutes.tsx` - Add route

**Database:**
- EF Migration to create `catalogos.formas_pago` table
- Seed script with 3 initial forms of payment

---

## Task 1: Create Backend Entity

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Entities/Catalogos/FormaPago.cs`

- [ ] **Step 1: Create FormaPago entity**

```csharp
namespace Lefarma.API.Domain.Entities.Catalogos
{
    public class FormaPago
    {
        public int IdFormaPago { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public string? Clave { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd lefarma.backend
git add src/Lefarma.API/Domain/Entities/Catalogos/FormaPago.cs
git commit -m "feat: add FormaPago entity"
```

---

## Task 2: Create EF Configuration

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Catalogos/FormaPagoConfiguration.cs`

- [ ] **Step 1: Create EF configuration**

```csharp
using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class FormaPagoConfiguration : IEntityTypeConfiguration<FormaPago>
    {
        public void Configure(EntityTypeBuilder<FormaPago> builder)
        {
            builder.ToTable("formas_pago", "catalogos");

            builder.HasKey(e => e.IdFormaPago);
            builder.Property(e => e.IdFormaPago)
                .HasColumnName("id_forma_pago")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.NombreNormalizado)
                .HasColumnName("nombre_normalizado")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(500);

            builder.Property(e => e.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(500);

            builder.Property(e => e.Clave)
                .HasColumnName("clave")
                .HasMaxLength(50);

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .IsRequired()
                .HasDefaultValueSql("GETDATE()");

            builder.Property(e => e.FechaModificacion)
                .HasColumnName("fecha_modificacion")
                .HasDefaultValueSql("GETDATE()");
        }
    }
```

- [ ] **Step 2: Register configuration in ApplicationDbContext**

Add to `ApplicationDbContext.cs` in `OnModelCreating`:
```csharp
modelBuilder.ApplyConfiguration(new FormaPagoConfiguration());
```

- [ ] **Step 3: Commit**

```bash
git add src/Lefarma.API/Infrastructure/Data/Configurations/Catalogos/FormaPagoConfiguration.cs
git add src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs
git commit -m "feat: add FormaPago EF configuration"
```

---

## Task 3: Create DTOs

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Catalogos/FormasPago/DTOs/FormaPagoDTOs.cs`

- [ ] **Step 1: Create DTOs**

```csharp
namespace Lefarma.API.Features.Catalogos.FormasPago.DTOs
{
    public class FormaPagoResponse
    {
        public int IdFormaPago { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateFormaPagoRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateFormaPagoRequest
    {
        public required int IdFormaPago { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public bool Activo { get; set; }
    }
}
```

- [ ] **Step 2: Add extension method for response mapping**

Create `Features/Catalogos/FormasPago/Extensions/FormaPagoExtensions.cs`:
```csharp
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;

namespace Lefarma.API.Features.Catalogos.FormasPago.Extensions
{
    public static class FormaPagoExtensions
    {
        public static FormaPagoResponse ToResponse(this FormaPago entity)
        {
            return new FormaPagoResponse
            {
                IdFormaPago = entity.IdFormaPago,
                Nombre = entity.Nombre,
                Descripcion = entity.Descripcion ?? string.Empty,
                Clave = entity.Clave ?? string.Empty,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion,
                FechaModificacion = entity.FechaModificacion
            };
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/Lefarma.API/Features/Catalogos/FormasPago/
git commit -m "feat: add FormaPago DTOs and extensions"
```

---

## Task 4: Create Validator

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Catalogos/FormasPago/FormaPagoValidator.cs`

- [ ] **Step 1: Create FluentValidation validator**

```csharp
using FluentValidation;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;

namespace Lefarma.API.Features.Catalogos.FormasPago
{
    public class FormaPagoValidator : AbstractValidator<CreateFormaPagoRequest>
    {
        public FormaPagoValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres");

            RuleFor(x => x.Clave)
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres");
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Lefarma.API/Features/Catalogos/FormasPago/FormaPagoValidator.cs
git commit -m "feat: add FormaPago validator"
```

---

## Task 5: Create Repository Interface

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/Catalogos/IFormaPagoRepository.cs`

- [ ] **Step 1: Create repository interface**

```csharp
using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Interfaces.Catalogos
{
    public interface IFormaPagoRepository
    {
        Task<IEnumerable<FormaPago?>> GetAllAsync();
        Task<FormaPago?> GetByIdAsync(int id);
        Task<bool> ExistsAsync(System.Linq.Expressions.Expression<Func<FormaPago, bool>> predicate);
        Task<FormaPago> AddAsync(FormaPago entity);
        Task<FormaPago> UpdateAsync(FormaPago entity);
        Task<bool> DeleteAsync(FormaPago entity);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Lefarma.API/Domain/Interfaces/Catalogos/IFormaPagoRepository.cs
git commit -m "feat: add IFormaPagoRepository interface"
```

---

## Task 6: Create Repository Implementation

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/Catalogos/FormaPagoRepository.cs`

- [ ] **Step 1: Create repository implementation**

```csharp
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos
{
    public class FormaPagoRepository : IFormaPagoRepository
    {
        private readonly ApplicationDbContext _context;

        public FormaPagoRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<FormaPago?>> GetAllAsync()
        {
            return await _context.FormasPago.ToListAsync();
        }

        public async Task<FormaPago?> GetByIdAsync(int id)
        {
            return await _context.FormasPago.FindAsync(id);
        }

        public async Task<bool> ExistsAsync(System.Linq.Expressions.Expression<Func<FormaPago, bool>> predicate)
        {
            return await _context.FormasPago.AnyAsync(predicate);
        }

        public async Task<FormaPago> AddAsync(FormaPago entity)
        {
            _context.FormasPago.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<FormaPago> UpdateAsync(FormaPago entity)
        {
            _context.FormasPago.Update(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<bool> DeleteAsync(FormaPago entity)
        {
            _context.FormasPago.Remove(entity);
            var result = await _context.SaveChangesAsync();
            return result > 0;
        }
    }
}
```

- [ ] **Step 2: Add DbSet to ApplicationDbContext**

Add to `ApplicationDbContext.cs`:
```csharp
public DbSet<FormaPago> FormasPago { get; set; }
```

- [ ] **Step 3: Commit**

```bash
git add src/Lefarma.API/Infrastructure/Data/Repositories/Catalogos/FormaPagoRepository.cs
git add src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs
git commit -m "feat: add FormaPagoRepository implementation"
```

---

## Task 7: Create Service Interface

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/Catalogos/IFormaPagoService.cs`

- [ ] **Step 1: Create service interface**

```csharp
using ErrorOr;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;

namespace Lefarma.API.Domain.Interfaces.Catalogos
{
    public interface IFormaPagoService
    {
        Task<ErrorOr<IEnumerable<FormaPagoResponse>>> GetAllAsync();
        Task<ErrorOr<FormaPagoResponse>> GetByIdAsync(int id);
        Task<ErrorOr<FormaPagoResponse>> CreateAsync(CreateFormaPagoRequest request);
        Task<ErrorOr<FormaPagoResponse>> UpdateAsync(int id, UpdateFormaPagoRequest request);
        Task<ErrorOr<bool>> DeleteAsync(int id);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Lefarma.API/Domain/Interfaces/Catalogos/IFormaPagoService.cs
git commit -m "feat: add IFormaPagoService interface"
```

---

## Task 8: Create Service Implementation

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Catalogos/FormasPago/FormaPagoService.cs`

- [ ] **Step 1: Create service implementation**

```csharp
using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;
using Lefarma.API.Features.Catalogos.FormasPago.Extensions;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Catalogos.FormasPago
{
    public class FormaPagoService : BaseService, IFormaPagoService
    {
        private readonly IFormaPagoRepository _formaPagoRepository;
        private readonly ILogger<FormaPagoService> _logger;
        protected override string EntityName => "FormaPago";

        public FormaPagoService(
            IFormaPagoRepository formaPagoRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<FormaPagoService> logger)
            : base(wideEventAccessor)
        {
            _formaPagoRepository = formaPagoRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<FormaPagoResponse>>> GetAllAsync()
        {
            try
            {
                var result = await _formaPagoRepository.GetAllAsync();
                if (result == null || !result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0);
                    return CommonErrors.NotFound("FormasPago");
                }

                var response = result
                    .Where(e => !string.IsNullOrWhiteSpace(e.Nombre))
                    .Select(e => e.ToResponse())
                    .OrderBy(e => e.Nombre)
                    .ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, items: response.Select(e => e.Nombre).ToList());
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", error: ex.Message);
                return CommonErrors.DatabaseError("obtener las formas de pago");
            }
        }

        public async Task<ErrorOr<FormaPagoResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _formaPagoRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("forma de pago", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"obtener la forma de pago");
            }
        }

        public async Task<ErrorOr<FormaPagoResponse>> CreateAsync(CreateFormaPagoRequest request)
        {
            try
            {
                var existeNombre = await _formaPagoRepository.ExistsAsync(s => s.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("forma de pago", "nombre", request.Nombre);
                }

                var formaPago = new FormaPago
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Clave = request.Clave,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _formaPagoRepository.AddAsync(formaPago);
                EnrichWideEvent(action: "Create", entityId: result.IdFormaPago, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: errorMessage);
                return CommonErrors.DatabaseError($"guardar la forma de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al crear la forma de pago.");
            }
        }

        public async Task<ErrorOr<FormaPagoResponse>> UpdateAsync(int id, UpdateFormaPagoRequest request)
        {
            try
            {
                var formaPago = await _formaPagoRepository.GetByIdAsync(id);
                if (formaPago == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("forma de pago", id.ToString());
                }

                var existeNombre = await _formaPagoRepository.ExistsAsync(s => s.Nombre == request.Nombre && s.IdFormaPago != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("forma de pago", "nombre", request.Nombre);
                }

                formaPago.Nombre = request.Nombre.Trim();
                formaPago.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                formaPago.Descripcion = request.Descripcion;
                formaPago.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                formaPago.Clave = request.Clave;
                formaPago.FechaModificacion = DateTime.UtcNow;
                formaPago.Activo = request.Activo;

                var result = await _formaPagoRepository.UpdateAsync(formaPago);
                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }
                EnrichWideEvent(action: "Update", entityId: id, error: errorMessage);
                return CommonErrors.ConcurrencyError("forma de pago");
            }
            catch (DbUpdateException ex)
            {
                var errorMessage = $"Exception Type: {ex.GetType().Name}, Message: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner Exception: {ex.InnerException.Message}";
                }
                EnrichWideEvent(action: "Update", entityId: id, error: errorMessage);
                return CommonErrors.DatabaseError($"actualizar la forma de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la forma de pago.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var formaPago = await _formaPagoRepository.GetByIdAsync(id);
                if (formaPago == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("forma de pago", id.ToString());
                }

                var eliminado = await _formaPagoRepository.DeleteAsync(formaPago);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("forma de pago");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: formaPago.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.DatabaseError($"eliminar la forma de pago");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, error: ex.Message);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la forma de pago.");
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Lefarma.API/Features/Catalogos/FormasPago/FormaPagoService.cs
git commit -m "feat: add FormaPagoService implementation"
```

---

## Task 9: Create Controller

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Catalogos/FormasPago/FormasPagoController.cs`

- [ ] **Step 1: Create controller**

```csharp
using FluentValidation;
using Lefarma.API.Features.Catalogos.FormasPago;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos
{
    [Route("api/catalogos/[controller]")]
    [ApiController]
    [EndpointGroupName("Catalogos")]
    public class FormasPagoController : ControllerBase
    {
        private readonly IFormaPagoService _formaPagoService;

        public FormasPagoController(IFormaPagoService formaPagoService)
        {
            _formaPagoService = formaPagoService;
        }

        [HttpGet]
        [SwaggerOperation(Summary = "Obtener todas las formas de pago", Description = "Retorna la lista completa de formas de pago")]
        public async Task<IActionResult> GetAll()
        {
            var result = await _formaPagoService.GetAllAsync();

            return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<FormaPagoResponse>>
            {
                Success = true,
                Message = "Formas de pago obtenidas exitosamente.",
                Data = data
            }));
        }

        [HttpGet("{id}")]
        [SwaggerOperation(Summary = "Obtener forma de pago por ID", Description = "Retorna una forma de pago específica por su identificador")]
        public async Task<IActionResult> GetById(
            [FromRoute][SwaggerParameter(Description = "Identificador único de la forma de pago", Required = true)] int id)
        {
            var result = await _formaPagoService.GetByIdAsync(id);

            return result.ToActionResult(this, data => Ok(new ApiResponse<FormaPagoResponse>
            {
                Success = true,
                Message = "Forma de pago obtenida exitosamente.",
                Data = data
            }));
        }

        [HttpPost]
        [SwaggerOperation(Summary = "Crear nueva forma de pago", Description = "Crea una forma de pago con los datos proporcionados")]
        public async Task<IActionResult> Create(
            [FromBody][SwaggerRequestBody(Description = "Datos de la forma de pago a crear", Required = true)] CreateFormaPagoRequest request)
        {
            var result = await _formaPagoService.CreateAsync(request);

            return result.ToActionResult(this, data => CreatedAtAction(
                nameof(GetById),
                new { id = data.IdFormaPago },
                new ApiResponse<FormaPagoResponse>
                {
                    Success = true,
                    Message = "Forma de pago creada exitosamente.",
                    Data = data
                }));
        }

        [HttpPut("{id}")]
        [SwaggerOperation(Summary = "Actualizar forma de pago", Description = "Actualiza los datos de una forma de pago existente")]
        public async Task<IActionResult> Update(
            [FromRoute][SwaggerParameter(Description = "Identificador de la forma de pago a actualizar", Required = true)] int id,
            [FromBody][SwaggerRequestBody(Description = "Datos actualizados de la forma de pago", Required = true)] UpdateFormaPagoRequest request)
        {
            var result = await _formaPagoService.UpdateAsync(id, request);

            return result.ToActionResult(this, data => Ok(new ApiResponse<FormaPagoResponse>
            {
                Success = true,
                Message = "Forma de pago actualizada exitosamente.",
                Data = data
            }));
        }

        [HttpDelete("{id}")]
        [SwaggerOperation(Summary = "Eliminar forma de pago", Description = "Elimina una forma de pago por su identificador")]
        public async Task<IActionResult> Delete(
            [FromRoute][SwaggerParameter(Description = "Identificador de la forma de pago a eliminar", Required = true)] int id)
        {
            var result = await _formaPagoService.DeleteAsync(id);

            return result.ToActionResult(this, success => Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Forma de pago eliminada exitosamente.",
                Data = null
            }));
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/Lefarma.API/Features/Catalogos/FormasPago/FormasPagoController.cs
git commit -m "feat: add FormasPagoController with CRUD endpoints"
```

---

## Task 10: Register Services in DI

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Program.cs`

- [ ] **Step 1: Add repository and service registrations**

Find the section where other catalogs are registered (around line 200-300) and add:

```csharp
// FormasPago
builder.Services.AddScoped<IFormaPagoRepository, FormaPagoRepository>();
builder.Services.AddScoped<IFormaPagoService, FormaPagoService>();
```

- [ ] **Step 2: Commit**

```bash
git add src/Lefarma.API/Program.cs
git commit -m "feat: register FormaPago services in DI"
```

---

## Task 11: Create EF Migration

**Files:**
- Create: EF Migration via CLI

- [ ] **Step 1: Create migration**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet ef migrations add AddFormasPagoTable --context ApplicationDbContext
```

Expected: New migration file created in `Migrations/` folder

- [ ] **Step 2: Apply migration**

```bash
dotnet ef database update --context ApplicationDbContext
```

Expected: Database updated, table `catalogos.formas_pago` created

- [ ] **Step 3: Commit**

```bash
cd ../../..
git add lefarma.backend/src/Lefarma.API/Migrations/
git add lefarma.backend/src/Lefarma.API/Data/ApplicationDbContext.cs
git commit -m "feat: create and apply AddFormasPagoTable migration"
```

---

## Task 12: Seed Initial Data

**Files:**
- Create: `scripts/seed-formas-pago.sh`

- [ ] **Step 1: Create seed script**

```bash
#!/bin/bash
# Script para poblar catálogo de Formas de Pago

API_URL="http://localhost:5000/api"
USERNAME="54"
PASSWORD="tt01tt"

echo "=== Paso 1: Buscar dominios del usuario ==="
STEP1_RESPONSE=$(curl -s "$API_URL/auth/login-step-one" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\"}")

AVAILABLE_DOMAIN=$(echo "$STEP1_RESPONSE" | jq -r '.data.domains[0] // empty')

if [ -z "$AVAILABLE_DOMAIN" ]; then
    echo "No se encontraron dominios para el usuario"
    exit 1
fi

echo "Dominio encontrado: $AVAILABLE_DOMAIN"
echo ""
echo "=== Paso 2: Autenticando ==="
STEP2_RESPONSE=$(curl -s "$API_URL/auth/login-step-two" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"password\": \"$PASSWORD\",
    \"domain\": \"$AVAILABLE_DOMAIN\"
  }")

TOKEN=$(echo "$STEP2_RESPONSE" | jq -r '.data.accessToken // empty')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Error de autenticación"
    echo "$STEP2_RESPONSE" | jq .
    exit 1
fi

echo "✓ Autenticación exitosa"

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo ""
echo "=== Creando Formas de Pago ==="

create_forma_pago() {
    local nombre=$1
    local clave=$2
    local descripcion=$3

    RESPONSE=$(curl -s "$API_URL/catalogos/formaspago" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "{
        \"nombre\": \"$nombre\",
        \"clave\": \"$clave\",
        \"descripcion\": \"$descripcion\",
        \"activo\": true
      }")

    ID=$(echo "$RESPONSE" | jq -r '.data.idFormaPago // empty')

    if [ -n "$ID" ]; then
        echo "  ✓ Forma de pago creada: $nombre (ID: $ID)"
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].description // "Unknown error"')
        if [[ "$ERROR" == *"Already exists"* ]] || [[ "$ERROR" == *"Ya existe"* ]] || [[ "$ERROR" == *"already"* ]]; then
            echo "  ✓ Forma de pago ya existe: $nombre"
        else
            echo "  ✗ Error creando forma de pago $nombre: $ERROR"
        fi
    fi
}

echo "Formas de pago:"
create_forma_pago "Pago a contado" "EFO" "Pago total al momento"
create_forma_pago "Pago a crédito" "CRE" "Pago diferido según acuerdo con proveedor"
create_forma_pago "Pago parcial" "PAR" "Anticipo + saldo pendiente"

echo ""
echo "✓ Proceso completado"
echo ""
echo "Resumen:"
echo "- 3 Formas de pago creadas"
echo "  * Pago a contado (EFO)"
echo "  * Pago a crédito (CRE)"
echo "  * Pago parcial (PAR)"
```

- [ ] **Step 2: Make script executable and run**

```bash
chmod +x scripts/seed-formas-pago.sh
./scripts/seed-formas-pago.sh
```

Expected: 3 forms of payment created successfully

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-formas-pago.sh
git commit -m "feat: add seed script for formas de pago"
```

---

## Task 13: Create Frontend Page

**Files:**
- Create: `lefarma.frontend/src/pages/catalogos/generales/FormasPago/FormasPagoList.tsx`

- [ ] **Step 1: Create FormasPagoList.tsx component**

```typescript
import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { CreditCard, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/FormasPago';

const formaPagoSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  clave: z.string().optional().or(z.literal('')),
  activo: z.boolean(),
});

interface FormaPago {
  idFormaPago: number;
  nombre: string;
  descripcion?: string;
  clave?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

type FormaPagoFormValues = z.infer<typeof formaPagoSchema>;
type FormaPagoRequest = FormaPagoFormValues & { idFormaPago: number };

export default function FormasPagoList() {
  usePageTitle('Formas de Pago', 'Gestión de formas de pago del catálogo general');
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formaPagoId, setFormaPagoId] = useState(0);

  const [modalStates, setModalStates] = useState({ newFormaPago: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formFormaPago = useForm<FormaPagoFormValues>({
    resolver: zodResolver(formaPagoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      clave: '',
      activo: true,
    },
  });

  const fetchFormasPago = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<FormaPago[]>>(ENDPOINT);
      if (response.data.success) {
        setFormasPago(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'FormasPago.NotFound');
      if (isNotFound) {
        setFormasPago([]);
      } else {
        toast.error(error?.message ?? 'Error al cargar las formas de pago');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormasPago();
  }, []);

  const handleNuevaFormaPago = () => {
    setFormaPagoId(0);
    formFormaPago.reset();
    setIsEditing(false);
    toggleModal('newFormaPago', true);
  };

  const handleEditFormaPago = (id: number) => {
    const formaPago = formasPago.find((f) => f.idFormaPago === id);
    if (formaPago) {
      setFormaPagoId(formaPago.idFormaPago);
      formFormaPago.reset({
        nombre: formaPago.nombre,
        descripcion: formaPago.descripcion || '',
        clave: formaPago.clave || '',
        activo: formaPago.activo,
      });
      setIsEditing(true);
      toggleModal('newFormaPago', true);
    }
  };

  const handleSaveFormaPago = async (values: FormaPagoFormValues) => {
    setIsSaving(true);
    try {
      const payload: FormaPagoRequest = { idFormaPago: formaPagoId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${formaPagoId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Forma de pago actualizada correctamente.' : 'Forma de pago creada correctamente.');
        toggleModal('newFormaPago', false);
        await fetchFormasPago();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la forma de pago');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar la forma de pago');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta forma de pago?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Forma de pago eliminada correctamente');
        fetchFormasPago();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar la forma de pago');
    }
  };

  const filteredFormasPago = useMemo(() => {
    return formasPago.filter((f) =>
      f.nombre.toLowerCase().includes(search.toLowerCase()) ||
      f.clave?.toLowerCase().includes(search.toLowerCase()) ||
      f.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [formasPago, search]);

  const columns: ColumnDef<FormaPago>[] = [
    {
      accessorKey: 'nombre',
      header: 'Forma de Pago',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <CreditCard className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            {row.original.clave && (
              <span className="text-xs text-muted-foreground">{row.original.clave}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[240px] block">
          {row.original.descripcion || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'} className="h-5">
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5"
            onClick={() => handleEditFormaPago(row.original.idFormaPago)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idFormaPago)}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, clave o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevaFormaPago}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Forma de Pago
        </Button>
      </div>

      <div className="relative">
        {!loading && formasPago.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <CreditCard className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay formas de pago registradas</p>
            <Button className="mt-4" size="sm" onClick={fetchFormasPago}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredFormasPago}
              title="Listado de Formas de Pago"
              showRowCount
              showRefreshButton
              onRefresh={fetchFormasPago}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        id="modal-forma-pago"
        open={modalStates.newFormaPago}
        setOpen={(open) => toggleModal('newFormaPago', open)}
        title={isEditing ? 'Editar Forma de Pago' : 'Nueva Forma de Pago'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newFormaPago', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formFormaPago.handleSubmit(handleSaveFormaPago)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Forma de Pago'}
            </Button>
          </div>
        }
      >
        <Form {...formFormaPago}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formFormaPago.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre de la forma de pago" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formFormaPago.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl><Input placeholder="Clave interna (ej. EFO)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formFormaPago.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Input placeholder="Descripción breve" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formFormaPago.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>La forma de pago aparecerá en los catálogos.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd lefarma.frontend
git add src/pages/catalogos/generales/FormasPago/FormasPagoList.tsx
git commit -m "feat: add FormasPagoList page with CRUD"
```

---

## Task 14: Add Route and Sidebar Menu

**Files:**
- Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`
- Modify: `lefarma.frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add route to AppRoutes.tsx**

Find the catalogos section and add:
```typescript
import FormasPagoList from '@/pages/catalogos/generales/FormasPago/FormasPagoList';

// In routes array:
{
  path: '/catalogos/formas-pago',
  element: <ProtectedRoute><FormasPagoList /></ProtectedRoute>,
},
```

- [ ] **Step 2: Add menu item to Sidebar.tsx**

Find the catalogos generales section and add:
```typescript
{
  name: 'Formas de Pago',
  href: '/catalogos/formas-pago',
  icon: CreditCard,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/AppRoutes.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add FormasPago route and sidebar menu item"
```

---

## Task 15: Verify Implementation

**Files:** None (testing)

- [ ] **Step 1: Start backend**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet run
```

Expected: API running on http://localhost:5000

- [ ] **Step 2: Start frontend**

```bash
cd lefarma.frontend
npm run dev
```

Expected: Frontend running on http://localhost:5173

- [ ] **Step 3: Test endpoints**

```bash
# Test GET all
curl http://localhost:5000/api/catalogos/formaspago

# Expected: Array with 3 formas de pago
```

- [ ] **Step 4: Test UI**

1. Navigate to http://localhost:5173
2. Login (use username: 54, password: tt01tt)
3. Click "Formas de Pago" in sidebar
4. Verify:
   - Table shows 3 forms of payment
   - Search works
   - "Nueva Forma de Pago" button opens modal
   - Create new form works
   - Edit button works
   - Delete button works with confirmation
   - Toast notifications appear

- [ ] **Step 5: Final commit**

```bash
cd ../..
git add -A
git commit -m "feat: complete Formas de Pago catalog implementation"
```

---

## Summary

This plan creates a complete Forms of Payment catalog with:

**Backend:**
- Entity, EF Configuration, Repository, Service, Controller, Validator, DTOs
- Full CRUD API with proper error handling
- Database table via EF migration
- 3 initial seeded records

**Frontend:**
- Complete CRUD page following Areas pattern
- DataTable with search, modal forms, toast notifications
- Route and sidebar menu integration

**Total files:** 11 new backend files, 2 new frontend files, 3 modified files
**Estimated time:** 45-60 minutes for implementation
