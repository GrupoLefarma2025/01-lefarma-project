# Carga de días oficiales de vacaciones — Implementation Plan (Fase 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar la pantalla de carga de días oficiales de vacaciones por empresa/sucursal, con replicación automática a `rh.vacaciones_usuarios` para cada usuario activo.

**Architecture:** El backend usa Controller → Service → Repository con `ErrorOr<T>` y `ToActionResult`. El frontend usa React Router 7 factory, React Hook Form + Zod, TanStack Table (`DataTable`), shadcn/ui, y carga masiva CSV con `Papa.parse`. La base de datos usa scripts SQL manuales; no se usan EF Migrations.

**Tech Stack:** .NET 10, EF Core, SQL Server, CsvHelper, React 19, Vite 7, TypeScript, Zod, TanStack Table, shadcn/ui, Papa.parse, Axios.

---

## Task 1: Crear script SQL de base de datos

**Files:**
- Create: `lefarma.database/026_create_dias_oficiales_y_vacaciones_usuarios.sql`

**Step 1: Escribir el script SQL**

```sql
CREATE TABLE rh.dias_oficiales (
    id_dia_oficial INT IDENTITY(1,1) PRIMARY KEY,
    id_empresa INT NOT NULL,
    id_sucursal INT NOT NULL,
    anio INT NOT NULL,
    mes INT NOT NULL,
    dia INT NOT NULL,
    fecha DATE NOT NULL,
    descripcion NVARCHAR(100) NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_dias_oficiales_empresa_sucursal_fecha UNIQUE (id_empresa, id_sucursal, fecha),
    CONSTRAINT FK_dias_oficiales_empresa FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas(id_empresa),
    CONSTRAINT FK_dias_oficiales_sucursal FOREIGN KEY (id_sucursal) REFERENCES catalogos.sucursales(id_sucursal)
);

CREATE INDEX IX_dias_oficiales_empresa_sucursal_anio ON rh.dias_oficiales(id_empresa, id_sucursal, anio);

CREATE TABLE rh.vacaciones_usuarios (
    id_vacacion_usuario INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_empresa INT NOT NULL,
    id_sucursal INT NOT NULL,
    anio INT NOT NULL,
    mes INT NOT NULL,
    dia INT NOT NULL,
    fecha DATE NOT NULL,
    tipo NVARCHAR(20) NOT NULL,
    estado NVARCHAR(20) NOT NULL,
    id_dia_oficial INT NULL,
    comentarios NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_vacaciones_usuarios_usuario_fecha UNIQUE (id_usuario, fecha),
    CONSTRAINT FK_vacaciones_usuarios_usuario FOREIGN KEY (id_usuario) REFERENCES app.Usuarios(IdUsuario),
    CONSTRAINT FK_vacaciones_usuarios_empresa FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas(id_empresa),
    CONSTRAINT FK_vacaciones_usuarios_sucursal FOREIGN KEY (id_sucursal) REFERENCES catalogos.sucursales(id_sucursal),
    CONSTRAINT FK_vacaciones_usuarios_dia_oficial FOREIGN KEY (id_dia_oficial) REFERENCES rh.dias_oficiales(id_dia_oficial),
    CONSTRAINT CK_vacaciones_usuarios_tipo CHECK (tipo IN ('OFICIAL', 'INDIVIDUAL')),
    CONSTRAINT CK_vacaciones_usuarios_estado CHECK (estado IN ('ASIGNADO', 'TOMADO'))
);

CREATE INDEX IX_vacaciones_usuarios_usuario_anio ON rh.vacaciones_usuarios(id_usuario, anio);
CREATE INDEX IX_vacaciones_usuarios_empresa_sucursal ON rh.vacaciones_usuarios(id_empresa, id_sucursal);
```

**Step 2: Verificar que el script no tenga errores de sintaxis**

Run: Abrir SQL Server Management Studio o ejecutar `sqlcmd` en modo parse. En desarrollo, se puede revisar visualmente.

**Step 3: Commit**

```bash
git add lefarma.database/026_create_dias_oficiales_y_vacaciones_usuarios.sql
git commit -m "db: add dias_oficiales and vacaciones_usuarios tables"
```

---

## Task 2: Crear entidades de dominio

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Domain/Entities/Rh/DiaOficial.cs`
- Create: `lefarma.backend/src/Lefarma.API/Domain/Entities/Rh/VacacionUsuario.cs`

**Step 1: Escribir `DiaOficial.cs`**

```csharp
namespace Lefarma.API.Domain.Entities.Rh;

public class DiaOficial
{
    public int IdDiaOficial { get; set; }
    public int IdEmpresa { get; set; }
    public int IdSucursal { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public int Dia { get; set; }
    public DateTime Fecha { get; set; }
    public string? Descripcion { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
}
```

**Step 2: Escribir `VacacionUsuario.cs`**

```csharp
namespace Lefarma.API.Domain.Entities.Rh;

public class VacacionUsuario
{
    public int IdVacacionUsuario { get; set; }
    public int IdUsuario { get; set; }
    public int IdEmpresa { get; set; }
    public int IdSucursal { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public int Dia { get; set; }
    public DateTime Fecha { get; set; }
    public string Tipo { get; set; } = "OFICIAL";
    public string Estado { get; set; } = "ASIGNADO";
    public int? IdDiaOficial { get; set; }
    public string? Comentarios { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
}
```

**Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Domain/Entities/Rh/DiaOficial.cs lefarma.backend/src/Lefarma.API/Domain/Entities/Rh/VacacionUsuario.cs
git commit -m "domain: add DiaOficial and VacacionUsuario entities"
```

---

## Task 3: Crear configuraciones EF Core

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Rh/DiaOficialConfiguration.cs`
- Create: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Rh/VacacionUsuarioConfiguration.cs`

**Step 1: Escribir `DiaOficialConfiguration.cs`**

```csharp
using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh;

public class DiaOficialConfiguration : IEntityTypeConfiguration<DiaOficial>
{
    public void Configure(EntityTypeBuilder<DiaOficial> builder)
    {
        builder.ToTable("dias_oficiales", "rh");
        builder.HasKey(e => e.IdDiaOficial);

        builder.Property(e => e.IdDiaOficial).HasColumnName("id_dia_oficial");
        builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
        builder.Property(e => e.IdSucursal).HasColumnName("id_sucursal");
        builder.Property(e => e.Anio).HasColumnName("anio");
        builder.Property(e => e.Mes).HasColumnName("mes");
        builder.Property(e => e.Dia).HasColumnName("dia");
        builder.Property(e => e.Fecha).HasColumnName("fecha");
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(100);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");

        builder.HasIndex(e => new { e.IdEmpresa, e.IdSucursal, e.Anio }).HasDatabaseName("IX_dias_oficiales_empresa_sucursal_anio");
    }
}
```

**Step 2: Escribir `VacacionUsuarioConfiguration.cs`**

```csharp
using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh;

public class VacacionUsuarioConfiguration : IEntityTypeConfiguration<VacacionUsuario>
{
    public void Configure(EntityTypeBuilder<VacacionUsuario> builder)
    {
        builder.ToTable("vacaciones_usuarios", "rh");
        builder.HasKey(e => e.IdVacacionUsuario);

        builder.Property(e => e.IdVacacionUsuario).HasColumnName("id_vacacion_usuario");
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
        builder.Property(e => e.IdSucursal).HasColumnName("id_sucursal");
        builder.Property(e => e.Anio).HasColumnName("anio");
        builder.Property(e => e.Mes).HasColumnName("mes");
        builder.Property(e => e.Dia).HasColumnName("dia");
        builder.Property(e => e.Fecha).HasColumnName("fecha");
        builder.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(20);
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(20);
        builder.Property(e => e.IdDiaOficial).HasColumnName("id_dia_oficial");
        builder.Property(e => e.Comentarios).HasColumnName("comentarios").HasMaxLength(250);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");

        builder.HasIndex(e => new { e.IdUsuario, e.Anio }).HasDatabaseName("IX_vacaciones_usuarios_usuario_anio");
        builder.HasIndex(e => new { e.IdEmpresa, e.IdSucursal }).HasDatabaseName("IX_vacaciones_usuarios_empresa_sucursal");
    }
}
```

**Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Rh/DiaOficialConfiguration.cs lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Rh/VacacionUsuarioConfiguration.cs
git commit -m "infra: add EF Core configurations for vacation entities"
```

---

## Task 4: Registrar DbSets en ApplicationDbContext

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`

**Step 1: Localizar la sección de DbSets**

Buscar líneas similares a:

```csharp
public DbSet<SolicitudPersonal> SolicitudesPersonal { get; set; } = null!;
```

**Step 2: Agregar los nuevos DbSets**

```csharp
public DbSet<DiaOficial> DiasOficiales { get; set; } = null!;
public DbSet<VacacionUsuario> VacacionesUsuarios { get; set; } = null!;
```

**Step 3: Aplicar configuraciones**

Asegurar que en `OnModelCreating` se llame a:

```csharp
modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
```

Si ya está, no se necesita cambio adicional.

**Step 4: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs
git commit -m "infra: register DiasOficiales and VacacionesUsuarios DbSets"
```

---

## Task 5: Crear DTOs del backend

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/DTOs/DiaOficialDtos.cs`

**Step 1: Escribir el archivo**

```csharp
namespace Lefarma.API.Features.Rh.Vacaciones.DTOs;

public class DiaOficialRequest
{
    public int? IdEmpresa { get; set; }
    public int? IdSucursal { get; set; }
    public int? Anio { get; set; }
    public int? Mes { get; set; }
}

public class DiaOficialResponse
{
    public int IdDiaOficial { get; set; }
    public int IdEmpresa { get; set; }
    public string? EmpresaNombre { get; set; }
    public int IdSucursal { get; set; }
    public string? SucursalNombre { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public int Dia { get; set; }
    public DateTime Fecha { get; set; }
    public string? Descripcion { get; set; }
    public bool Activo { get; set; }
}

public class CargaDiasOficialesRequest
{
    public int IdEmpresa { get; set; }
    public int IdSucursal { get; set; }
    public List<DiaOficialFechaRequest> Fechas { get; set; } = new();
    public string? DescripcionGeneral { get; set; }
}

public class DiaOficialFechaRequest
{
    public int Anio { get; set; }
    public int Mes { get; set; }
    public int Dia { get; set; }
    public string? Descripcion { get; set; }
}

public class CargaDiasOficialesCsvRow
{
    public int Dia { get; set; }
    public int Mes { get; set; }
    public int Anio { get; set; }
    public string? Descripcion { get; set; }
}

public class BulkUploadRowError
{
    public int RowNumber { get; set; }
    public string RowData { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
}

public class CargaDiasOficialesResultResponse
{
    public int TotalRows { get; set; }
    public int SuccessCount { get; set; }
    public int ErrorCount { get; set; }
    public List<BulkUploadRowError> Errors { get; set; } = new();
    public int UsuariosAfectados { get; set; }
    public int VacacionesGeneradas { get; set; }
}

public class VacacionUsuarioResponse
{
    public int IdVacacionUsuario { get; set; }
    public int IdUsuario { get; set; }
    public string? UsuarioNombre { get; set; }
    public int IdEmpresa { get; set; }
    public int IdSucursal { get; set; }
    public DateTime Fecha { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public int? IdDiaOficial { get; set; }
    public string? Comentarios { get; set; }
}
```

**Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/DTOs/DiaOficialDtos.cs
git commit -m "api: add DiaOficial DTOs"
```

---

## Task 6: Crear servicio de negocio

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/IVacacionesService.cs`
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/VacacionesService.cs`

**Step 1: Escribir la interfaz**

```csharp
using ErrorOr;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;

namespace Lefarma.API.Features.Rh.Vacaciones;

public interface IVacacionesService
{
    Task<ErrorOr<List<DiaOficialResponse>>> ObtenerDiasOficialesAsync(DiaOficialRequest request);
    Task<ErrorOr<CargaDiasOficialesResultResponse>> CargarDiasOficialesManualAsync(CargaDiasOficialesRequest request, int idUsuario);
    Task<ErrorOr<CargaDiasOficialesResultResponse>> CargarDiasOficialesDesdeCsvAsync(IFormFile file, int idEmpresa, int idSucursal, int idUsuario);
    Task<ErrorOr<Deleted>> EliminarDiaOficialAsync(int idDiaOficial, int idUsuario);
    Task<ErrorOr<List<VacacionUsuarioResponse>>> ObtenerVacacionesUsuariosAsync(int idDiaOficial);
}
```

**Step 2: Implementar el servicio**

Crear `VacacionesService.cs` con la lógica completa. Ver el siguiente bloque de código.

```csharp
using CsvHelper;
using CsvHelper.Configuration;
using ErrorOr;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Lefarma.API.Features.Rh.Vacaciones;

public class VacacionesService : BaseService, IVacacionesService
{
    private readonly ApplicationDbContext _context;

    public VacacionesService(ApplicationDbContext context)
    {
        _context = context;
    }

    protected override string EntityName => "DiasOficiales";

    public async Task<ErrorOr<List<DiaOficialResponse>>> ObtenerDiasOficialesAsync(DiaOficialRequest request)
    {
        try
        {
            var query = _context.DiasOficiales
                .AsNoTracking()
                .Where(d => d.Activo)
                .AsQueryable();

            if (request.IdEmpresa.HasValue)
                query = query.Where(d => d.IdEmpresa == request.IdEmpresa.Value);

            if (request.IdSucursal.HasValue)
                query = query.Where(d => d.IdSucursal == request.IdSucursal.Value);

            if (request.Anio.HasValue)
                query = query.Where(d => d.Anio == request.Anio.Value);

            if (request.Mes.HasValue)
                query = query.Where(d => d.Mes == request.Mes.Value);

            var result = await query
                .OrderBy(d => d.Fecha)
                .Select(d => new DiaOficialResponse
                {
                    IdDiaOficial = d.IdDiaOficial,
                    IdEmpresa = d.IdEmpresa,
                    IdSucursal = d.IdSucursal,
                    Anio = d.Anio,
                    Mes = d.Mes,
                    Dia = d.Dia,
                    Fecha = d.Fecha,
                    Descripcion = d.Descripcion,
                    Activo = d.Activo
                })
                .ToListAsync();

            return result;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ObtenerDiasOficiales", exception: ex);
            return CommonErrors.Unexpected("Error al obtener días oficiales");
        }
    }

    public async Task<ErrorOr<CargaDiasOficialesResultResponse>> CargarDiasOficialesManualAsync(CargaDiasOficialesRequest request, int idUsuario)
    {
        try
        {
            var fechas = request.Fechas.Select(f => new DateTime(f.Anio, f.Mes, f.Dia)).ToList();
            return await CargarDiasOficialesInternoAsync(request.IdEmpresa, request.IdSucursal, fechas, request.DescripcionGeneral, idUsuario);
        }
        catch (Exception ex)
        {
            EnrichWideEvent("CargarDiasOficialesManual", exception: ex);
            return CommonErrors.Unexpected("Error al cargar días oficiales");
        }
    }

    public async Task<ErrorOr<CargaDiasOficialesResultResponse>> CargarDiasOficialesDesdeCsvAsync(IFormFile file, int idEmpresa, int idSucursal, int idUsuario)
    {
        try
        {
            using var reader = new StreamReader(file.OpenReadStream());
            using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HeaderValidated = null, MissingFieldFound = null });
            var rows = csv.GetRecords<CargaDiasOficialesCsvRow>().ToList();

            var fechas = rows.Select(r => new DateTime(r.Anio, r.Mes, r.Dia)).ToList();
            return await CargarDiasOficialesInternoAsync(idEmpresa, idSucursal, fechas, null, idUsuario);
        }
        catch (Exception ex)
        {
            EnrichWideEvent("CargarDiasOficialesCsv", exception: ex);
            return CommonErrors.Unexpected("Error al procesar el archivo CSV");
        }
    }

    private async Task<ErrorOr<CargaDiasOficialesResultResponse>> CargarDiasOficialesInternoAsync(int idEmpresa, int idSucursal, List<DateTime> fechas, string? descripcionGeneral, int idUsuario)
    {
        var result = new CargaDiasOficialesResultResponse
        {
            TotalRows = fechas.Count,
            SuccessCount = 0,
            ErrorCount = 0,
            Errors = new List<BulkUploadRowError>()
        };

        var empresa = await _context.Empresas.AsNoTracking().FirstOrDefaultAsync(e => e.IdEmpresa == idEmpresa);
        if (empresa == null)
            return CommonErrors.NotFound("Empresa", idEmpresa.ToString());

        var sucursal = await _context.Sucursales.AsNoTracking().FirstOrDefaultAsync(s => s.IdSucursal == idSucursal);
        if (sucursal == null)
            return CommonErrors.NotFound("Sucursal", idSucursal.ToString());

        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var diasOficiales = new List<DiaOficial>();
            var rowNumber = 1;

            foreach (var fecha in fechas)
            {
                var exists = await _context.DiasOficiales
                    .AsNoTracking()
                    .AnyAsync(d => d.IdEmpresa == idEmpresa && d.IdSucursal == idSucursal && d.Fecha == fecha && d.Activo);

                if (exists)
                {
                    result.ErrorCount++;
                    result.Errors.Add(new BulkUploadRowError
                    {
                        RowNumber = rowNumber,
                        RowData = $"{fecha.Day}/{fecha.Month}/{fecha.Year}",
                        Error = "El día ya existe para esta empresa y sucursal."
                    });
                    rowNumber++;
                    continue;
                }

                var diaOficial = new DiaOficial
                {
                    IdEmpresa = idEmpresa,
                    IdSucursal = idSucursal,
                    Anio = fecha.Year,
                    Mes = fecha.Month,
                    Dia = fecha.Day,
                    Fecha = fecha,
                    Descripcion = descripcionGeneral
                };

                diasOficiales.Add(diaOficial);
                result.SuccessCount++;
                rowNumber++;
            }

            await _context.DiasOficiales.AddRangeAsync(diasOficiales);
            await _context.SaveChangesAsync();

            // Replicar a usuarios
            var usuarios = await _context.UsuarioDetalle
                .AsNoTracking()
                .Where(u => u.IdEmpresa == idEmpresa && u.IdSucursal == idSucursal && u.Activo)
                .Select(u => u.IdUsuario)
                .ToListAsync();

            var vacaciones = new List<VacacionUsuario>();

            foreach (var diaOficial in diasOficiales)
            {
                foreach (var idUser in usuarios)
                {
                    var alreadyExists = await _context.VacacionesUsuarios
                        .AsNoTracking()
                        .AnyAsync(v => v.IdUsuario == idUser && v.Fecha == diaOficial.Fecha && v.Activo);

                    if (alreadyExists) continue;

                    vacaciones.Add(new VacacionUsuario
                    {
                        IdUsuario = idUser,
                        IdEmpresa = idEmpresa,
                        IdSucursal = idSucursal,
                        Anio = diaOficial.Anio,
                        Mes = diaOficial.Mes,
                        Dia = diaOficial.Dia,
                        Fecha = diaOficial.Fecha,
                        Tipo = "OFICIAL",
                        Estado = "ASIGNADO",
                        IdDiaOficial = diaOficial.IdDiaOficial
                    });
                }
            }

            await _context.VacacionesUsuarios.AddRangeAsync(vacaciones);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            result.UsuariosAfectados = usuarios.Count;
            result.VacacionesGeneradas = vacaciones.Count;

            return result;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<ErrorOr<Deleted>> EliminarDiaOficialAsync(int idDiaOficial, int idUsuario)
    {
        try
        {
            var dia = await _context.DiasOficiales.FirstOrDefaultAsync(d => d.IdDiaOficial == idDiaOficial && d.Activo);
            if (dia == null)
                return CommonErrors.NotFound("DiaOficial", idDiaOficial.ToString());

            dia.Activo = false;

            var vacaciones = await _context.VacacionesUsuarios
                .Where(v => v.IdDiaOficial == idDiaOficial && v.Activo)
                .ToListAsync();

            foreach (var v in vacaciones)
                v.Activo = false;

            await _context.SaveChangesAsync();
            return Result.Deleted;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("EliminarDiaOficial", exception: ex);
            return CommonErrors.Unexpected("Error al eliminar día oficial");
        }
    }

    public async Task<ErrorOr<List<VacacionUsuarioResponse>>> ObtenerVacacionesUsuariosAsync(int idDiaOficial)
    {
        try
        {
            var result = await _context.VacacionesUsuarios
                .AsNoTracking()
                .Where(v => v.IdDiaOficial == idDiaOficial && v.Activo)
                .Select(v => new VacacionUsuarioResponse
                {
                    IdVacacionUsuario = v.IdVacacionUsuario,
                    IdUsuario = v.IdUsuario,
                    IdEmpresa = v.IdEmpresa,
                    IdSucursal = v.IdSucursal,
                    Fecha = v.Fecha,
                    Tipo = v.Tipo,
                    Estado = v.Estado,
                    IdDiaOficial = v.IdDiaOficial,
                    Comentarios = v.Comentarios
                })
                .ToListAsync();

            return result;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ObtenerVacacionesUsuarios", exception: ex);
            return CommonErrors.Unexpected("Error al obtener vacaciones de usuarios");
        }
    }
}
```

**Nota:** Ajustar `BaseService` y `CommonErrors` según los nombres reales del proyecto. Verificar que `ApplicationDbContext` tenga `Empresas`, `Sucursales`, `UsuarioDetalle` y propiedades `Activo`.

**Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/IVacacionesService.cs lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/VacacionesService.cs
git commit -m "feat: add VacacionesService with bulk upload and user replication"
```

---

## Task 7: Crear controller

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/VacacionesController.cs`

**Step 1: Escribir el controller**

```csharp
using Lefarma.API.Features.Rh.Vacaciones.DTOs;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Rh.Vacaciones;

[Route("api/rh/vacaciones")]
[ApiController]
[EndpointGroupName("Vacaciones")]
[Authorize]
public class VacacionesController : ControllerBase
{
    private readonly IVacacionesService _service;

    public VacacionesController(IVacacionesService service)
    {
        _service = service;
    }

    [HttpGet("dias-oficiales")]
    [HasPermission(Permissions.VacacionesVer)]
    [SwaggerOperation(Summary = "Obtener días oficiales de vacaciones")]
    public async Task<IActionResult> ObtenerDiasOficiales([FromQuery] DiaOficialRequest request)
    {
        var result = await _service.ObtenerDiasOficialesAsync(request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<DiaOficialResponse>>
        {
            Success = true,
            Message = "Días oficiales obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpPost("dias-oficiales")]
    [HasPermission(Permissions.VacacionesCargar)]
    [SwaggerOperation(Summary = "Cargar días oficiales manualmente")]
    public async Task<IActionResult> CargarDiasOficiales([FromBody] CargaDiasOficialesRequest request)
    {
        var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CargarDiasOficialesManualAsync(request, idUsuario);
        return result.ToActionResult(this, data => Ok(new ApiResponse<CargaDiasOficialesResultResponse>
        {
            Success = true,
            Message = "Días oficiales cargados exitosamente.",
            Data = data
        }));
    }

    [HttpPost("dias-oficiales/csv")]
    [HasPermission(Permissions.VacacionesCargar)]
    [SwaggerOperation(Summary = "Cargar días oficiales desde CSV")]
    public async Task<IActionResult> CargarDiasOficialesCsv([FromForm] int idEmpresa, [FromForm] int idSucursal, IFormFile file)
    {
        var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CargarDiasOficialesDesdeCsvAsync(file, idEmpresa, idSucursal, idUsuario);
        return result.ToActionResult(this, data => Ok(new ApiResponse<CargaDiasOficialesResultResponse>
        {
            Success = true,
            Message = "CSV procesado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("dias-oficiales/{id}")]
    [HasPermission(Permissions.VacacionesEliminar)]
    [SwaggerOperation(Summary = "Eliminar un día oficial")]
    public async Task<IActionResult> EliminarDiaOficial(int id)
    {
        var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.EliminarDiaOficialAsync(id, idUsuario);
        return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Día oficial eliminado exitosamente."
        }));
    }

    [HttpGet("dias-oficiales/{id}/usuarios")]
    [HasPermission(Permissions.VacacionesVer)]
    [SwaggerOperation(Summary = "Obtener usuarios afectados por un día oficial")]
    public async Task<IActionResult> ObtenerUsuariosAfectados(int id)
    {
        var result = await _service.ObtenerVacacionesUsuariosAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<VacacionUsuarioResponse>>
        {
            Success = true,
            Message = "Usuarios afectados obtenidos exitosamente.",
            Data = data
        }));
    }
}
```

**Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Rh/Vacaciones/VacacionesController.cs
git commit -m "api: add VacacionesController endpoints"
```

---

## Task 8: Agregar permisos

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Shared/Constants/AuthorizationConstants.cs`

**Step 1: Localizar la clase `Permissions`**

Buscar algo similar a:

```csharp
public static class Permissions
{
    public const string RhVer = "rh.ver";
    ...
}
```

**Step 2: Agregar constantes de permisos**

```csharp
public const string VacacionesVer = "rh.vacaciones.ver";
public const string VacacionesCargar = "rh.vacaciones.cargar";
public const string VacacionesEliminar = "rh.vacaciones.eliminar";
```

**Step 3: Verificar registro automático de permisos**

Si el sistema requiere registro manual en una lista de permisos, agregar los nuevos en la lista correspondiente.

**Step 4: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Shared/Constants/AuthorizationConstants.cs
git commit -m "auth: add vacation permissions constants"
```

---

## Task 9: Registrar servicio en DI

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Program.cs`

**Step 1: Localizar el registro de servicios de RH**

Buscar:

```csharp
builder.Services.AddScoped<ISolicitudPersonalService, SolicitudPersonalService>();
```

**Step 2: Agregar el registro**

```csharp
builder.Services.AddScoped<IVacacionesService, VacacionesService>();
```

**Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Program.cs
git commit -m "di: register IVacacionesService"
```

---

## Task 10: Compilar y ejecutar tests del backend

**Files:**
- Todos los archivos anteriores

**Step 1: Compilar la solución**

Run: `dotnet build lefarma.backend/src/Lefarma.API`

Expected: BUILD SUCCEEDED

**Step 2: Ejecutar tests existentes**

Run: `dotnet test lefarma.backend`

Expected: Tests pass (o al menos no se rompen por cambios en el API)

**Step 3: Commit si hay cambios menores**

```bash
git commit -m "build: fix backend compilation issues" || true
```

---

## Task 11: Crear tipos de TypeScript

**Files:**
- Create: `lefarma.frontend/src/types/vacaciones.types.ts`

**Step 1: Escribir el archivo**

```typescript
export interface DiaOficialResponse {
  idDiaOficial: number;
  idEmpresa: number;
  empresaNombre?: string;
  idSucursal: number;
  sucursalNombre?: string;
  anio: number;
  mes: number;
  dia: number;
  fecha: string;
  descripcion?: string;
  activo: boolean;
}

export interface CargaDiasOficialesRequest {
  idEmpresa: number;
  idSucursal: number;
  fechas: DiaOficialFechaRequest[];
  descripcionGeneral?: string;
}

export interface DiaOficialFechaRequest {
  anio: number;
  mes: number;
  dia: number;
  descripcion?: string;
}

export interface BulkUploadRowError {
  rowNumber: number;
  rowData: string;
  error: string;
}

export interface CargaDiasOficialesResultResponse {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: BulkUploadRowError[];
  usuariosAfectados: number;
  vacacionesGeneradas: number;
}

export interface VacacionUsuarioResponse {
  idVacacionUsuario: number;
  idUsuario: number;
  usuarioNombre?: string;
  idEmpresa: number;
  idSucursal: number;
  fecha: string;
  tipo: string;
  estado: string;
  idDiaOficial?: number;
  comentarios?: string;
}

export interface DiaOficialFilters {
  idEmpresa?: number;
  idSucursal?: number;
  anio?: number;
  mes?: number;
}
```

**Step 2: Commit**

```bash
git add lefarma.frontend/src/types/vacaciones.types.ts
git commit -m "types: add vacation TypeScript types"
```

---

## Task 12: Crear servicio API de frontend

**Files:**
- Create: `lefarma.frontend/src/apps/rh/services/vacaciones.api.ts`

**Step 1: Escribir el archivo**

```typescript
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  DiaOficialResponse,
  DiaOficialFilters,
  CargaDiasOficialesRequest,
  CargaDiasOficialesResultResponse,
  VacacionUsuarioResponse,
} from '@/types/vacaciones.types';

const BASE = '/rh/vacaciones';

export const vacacionesApi = {
  getDiasOficiales: (filters: DiaOficialFilters) =>
    API.get<ApiResponse<DiaOficialResponse[]>>(`${BASE}/dias-oficiales`, { params: filters }),

  createDiasOficiales: (data: CargaDiasOficialesRequest) =>
    API.post<ApiResponse<CargaDiasOficialesResultResponse>>(`${BASE}/dias-oficiales`, data),

  bulkUploadDiasOficiales: (file: File, idEmpresa: number, idSucursal: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('idEmpresa', String(idEmpresa));
    formData.append('idSucursal', String(idSucursal));
    return API.post<ApiResponse<CargaDiasOficialesResultResponse>>(`${BASE}/dias-oficiales/csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDiaOficial: (id: number) => API.delete<ApiResponse<unknown>>(`${BASE}/dias-oficiales/${id}`),

  getUsuariosAfectados: (idDiaOficial: number) =>
    API.get<ApiResponse<VacacionUsuarioResponse[]>>(`${BASE}/dias-oficiales/${idDiaOficial}/usuarios`),
};
```

**Step 2: Commit**

```bash
git add lefarma.frontend/src/apps/rh/services/vacaciones.api.ts
git commit -m "api: add frontend vacation API service"
```

---

## Task 13: Utilidades CSV de frontend

**Files:**
- Modify: `lefarma.frontend/src/utils/csv.ts`

**Step 1: Localizar el archivo**

Verificar si existe. Si no existe, crearlo.

**Step 2: Agregar utilidades para días oficiales**

```typescript
export const VACACIONES_DIAS_OFICIALES_COLUMNS = ['dia', 'mes', 'anio', 'descripcion'];

export interface ParsedDiaOficialRow {
  dia: number;
  mes: number;
  anio: number;
  descripcion?: string;
}

export function parseDiasOficialesCsv(data: string): ParsedDiaOficialRow[] {
  // Implementar con Papa.parse si es posible, o parser manual
  const lines = data.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i]?.trim() ?? '';
    });
    return {
      dia: Number(row.dia),
      mes: Number(row.mes),
      anio: Number(row.anio),
      descripcion: row.descripcion || undefined,
    };
  });
}

export function buildDiasOficialesErrorsCsv(errors: { rowNumber: number; rowData: string; error: string }[]): string {
  const headers = ['rowNumber', 'rowData', 'error'];
  const rows = errors.map((e) => [e.rowNumber, e.rowData, e.error].join(','));
  return [headers.join(','), ...rows].join('\n');
}
```

**Step 3: Commit**

```bash
git add lefarma.frontend/src/utils/csv.ts
git commit -m "utils: add CSV helpers for dias oficiales"
```

---

## Task 14: Agregar rutas y menú

**Files:**
- Modify: `lefarma.frontend/src/apps/rh/RhRoutes.tsx`
- Modify: `lefarma.frontend/src/apps/rh/menuItems.tsx`

**Step 1: Agregar ruta**

En `RhRoutes.tsx`, agregar:

```tsx
import { DiasOficialesPage } from './pages/Vacaciones/DiasOficialesPage';

<Route path="vacaciones/dias-oficiales" element={<DiasOficialesPage />} />
```

**Step 2: Agregar menú**

En `menuItems.tsx`, agregar dentro de la sección de RH:

```tsx
{
  label: 'Vacaciones',
  icon: CalendarDays,
  items: [
    { label: 'Días oficiales', path: '/rh/vacaciones/dias-oficiales' },
  ],
}
```

**Step 3: Commit**

```bash
git add lefarma.frontend/src/apps/rh/RhRoutes.tsx lefarma.frontend/src/apps/rh/menuItems.tsx
git commit -m "routes: add vacation menu and route"
```

---

## Task 15: Crear página principal

**Files:**
- Create: `lefarma.frontend/src/apps/rh/pages/Vacaciones/DiasOficialesPage.tsx`

**Step 1: Escribir la página**

La página debe incluir:

- Filtros: selects de empresa, sucursal, año (opcional), mes (opcional).
- Botones: "Agregar manual", "Cargar CSV", "Descargar plantilla".
- Tabla de días oficiales con `DataTable`.
- Acciones: eliminar día, ver usuarios afectados.

Pseudocódigo de la estructura:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vacacionesApi } from '../../services/vacaciones.api';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
// ... otros imports

export function DiasOficialesPage() {
  const [filters, setFilters] = useState({ idEmpresa: undefined, idSucursal: undefined, anio: new Date().getFullYear() });
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dias-oficiales', filters],
    queryFn: () => vacacionesApi.getDiasOficiales(filters),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Días oficiales de vacaciones</h1>
        <div className="space-x-2">
          <Button onClick={() => setIsCsvOpen(true)}>Cargar CSV</Button>
          <Button onClick={() => setIsManualOpen(true)}>Agregar manual</Button>
        </div>
      </div>
      {/* Filtros */}
      {/* Tabla */}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add lefarma.frontend/src/apps/rh/pages/Vacaciones/DiasOficialesPage.tsx
git commit -m "ui: add DiasOficialesPage"
```

---

## Task 16: Crear modal de carga manual

**Files:**
- Create: `lefarma.frontend/src/apps/rh/components/Vacaciones/CargaManualDiasOficialesModal.tsx`

**Step 1: Escribir el modal**

Incluir:

- Select de empresa y sucursal.
- Select de año.
- Componente para agregar múltiples fechas (calendario o select día/mes + botón agregar).
- Descripción general opcional.
- Preview de fechas agregadas.
- Botón guardar.

```tsx
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// ... imports

const schema = z.object({
  idEmpresa: z.number().min(1),
  idSucursal: z.number().min(1),
  descripcionGeneral: z.string().optional(),
  fechas: z.array(
    z.object({
      anio: z.number().min(2000),
      mes: z.number().min(1).max(12),
      dia: z.number().min(1).max(31),
      descripcion: z.string().optional(),
    })
  ).min(1),
});
```

**Step 2: Commit**

```bash
git add lefarma.frontend/src/apps/rh/components/Vacaciones/CargaManualDiasOficialesModal.tsx
git commit -m "ui: add manual load modal for dias oficiales"
```

---

## Task 17: Crear modal de carga CSV

**Files:**
- Create: `lefarma.frontend/src/apps/rh/components/Vacaciones/CargaCsvDiasOficialesModal.tsx`

**Step 1: Reutilizar patrón de `BulkUploadModal.tsx`**

Copiar/adaptar la estructura de:

```tsx
import { FileUploader } from '@/components/archivos/FileUploader';
import { parseDiasOficialesCsv, buildDiasOficialesErrorsCsv } from '@/utils/csv';
import { vacacionesApi } from '../../services/vacaciones.api';
```

Incluir:

- Select de empresa y sucursal.
- Drag & drop de CSV.
- Preview de filas parseadas.
- Botón de carga.
- Resultado con errores y descarga de CSV de errores.

**Step 2: Commit**

```bash
git add lefarma.frontend/src/apps/rh/components/Vacaciones/CargaCsvDiasOficialesModal.tsx
git commit -m "ui: add CSV bulk upload modal for dias oficiales"
```

---

## Task 18: Lint y build del frontend

**Files:**
- Todos los archivos de frontend

**Step 1: Ejecutar lint**

Run: `npm run lint` (desde `lefarma.frontend`)

Expected: Sin errores

**Step 2: Ejecutar build**

Run: `npm run build` (desde `lefarma.frontend`)

Expected: BUILD SUCCESS

**Step 3: Formatear**

Run: `npm run format` (desde `lefarma.frontend`)

**Step 4: Commit**

```bash
git commit -am "style: frontend lint and format" || true
```

---

## Task 19: Integrar con calendario existente

**Files:**
- Modify: `lefarma.frontend/src/apps/rh/components/MiCalendario.tsx` (opcional)
- Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/Rh/CalendarioRepository.cs` (opcional)

**Step 1: Extender el endpoint de calendario laboral**

Modificar `CalendarioRepository.cs` para que también incluya días de `rh.dias_oficiales` marcados como no laborables.

**Step 2: Ajustar `MiCalendario.tsx`**

Asegurar que los días de `dias_oficiales` se muestren como no laborables.

**Step 3: Commit**

```bash
git commit -am "feat: integrate dias_oficiales with calendar" || true
```

---

## Task 20: Tests unitarios e integración (opcional pero recomendado)

**Files:**
- Create: `lefarma.backend/tests/Lefarma.UnitTests/Features/Rh/Vacaciones/VacacionesServiceTests.cs`

**Step 1: Crear tests para el servicio**

- Test: `CargarDiasOficialesManualAsync_DebeInsertarDiaOficialYReplicarAUsuarios`
- Test: `EliminarDiaOficialAsync_DebeDesactivarDiaYVacaciones`
- Test: `CargarDiasOficialesManualAsync_DebeIgnorarFechasDuplicadas`

**Step 2: Ejecutar tests**

Run: `dotnet test lefarma.backend --filter "Category=Unit"`

Expected: Tests PASS

**Step 3: Commit**

```bash
git add lefarma.backend/tests/Lefarma.UnitTests/Features/Rh/Vacaciones/VacacionesServiceTests.cs
git commit -m "test: add unit tests for VacacionesService"
```

---

## Tareas pendientes y preguntas

1. Confirmar si la carga manual usará calendario múltiple, select día/mes/año, o ambos.
2. Confirmar si el CSV inicialmente soporta `.csv` o también `.xlsx`.
3. Confirmar si los días oficiales deben integrarse con el calendario de `MiCalendario.tsx` o eso es posterior.

---

## Notas finales

- No usar EF Migrations. Todas las tablas se crean con scripts SQL.
- Seguir el patrón Controller → Service → Repository existente.
- Usar `ErrorOr<T>` y `ToActionResult` para consistencia.
- Reutilizar componentes de UI (`DataTable`, `Modal`, `FileUploader`, `Select`) y el patrón de carga masiva de proveedores.
- Ejecutar `dotnet build` y `dotnet test` después de cada cambio importante en el backend.
- Ejecutar `npm run lint` y `npm run build` después de cambios en el frontend.
