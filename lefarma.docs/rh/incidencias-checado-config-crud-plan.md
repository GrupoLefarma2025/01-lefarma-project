# CRUD de Configuración de Descuentos por Incidencias de Checado - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear una pantalla de catálogo en `rh/catalogos` para administrar las reglas de `rh.incidencias_checado_config`, protegida por el permiso `incidencias_checado.crear`.

**Architecture:** Seguir el patrón de CRUD simple ya usado en `TiposSolicitudList`. Backend con controller + service + DTOs en `Lefarma.API`, frontend con página + API + tipos + ruta.

**Tech Stack:** ASP.NET Core 10, EF Core, React 19, TypeScript, React Hook Form, Zod, TanStack Table (via DataTable), shadcn/ui.

---

## Task 1: Backend DTOs

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/IncidenciasChecado/DTOs/IncidenciaChecadoConfigDtos.cs`

**Step 1: Crear los DTOs**

```csharp
using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;

public class IncidenciaChecadoConfigResponse
{
    public int IdConfig { get; set; }
    public string Nombre { get; set; } = null!;
    public string Descripcion { get; set; } = null!;
    public string TipoIncidencia { get; set; } = null!;
    public int? MinutosMin { get; set; }
    public int? MinutosMax { get; set; }
    public int CantidadAcumulada { get; set; }
    public string Periodo { get; set; } = null!;
    public int Prioridad { get; set; }
    public bool Activo { get; set; }
}

public class CreateIncidenciaChecadoConfigRequest
{
    [Required, MaxLength(100)]
    public string Nombre { get; set; } = null!;

    [Required, MaxLength(500)]
    public string Descripcion { get; set; } = null!;

    [Required, MaxLength(50)]
    public string TipoIncidencia { get; set; } = null!;

    public int? MinutosMin { get; set; }
    public int? MinutosMax { get; set; }

    [Range(1, int.MaxValue)]
    public int CantidadAcumulada { get; set; }

    [Required, MaxLength(20)]
    public string Periodo { get; set; } = null!;

    [Range(0, int.MaxValue)]
    public int Prioridad { get; set; }

    public bool Activo { get; set; } = true;
}

public class UpdateIncidenciaChecadoConfigRequest : CreateIncidenciaChecadoConfigRequest
{
    [Required]
    public int IdConfig { get; set; }
}
```

**Step 2: Compilar**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`
Expected: SUCCESS

---

## Task 2: Backend Service

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/IncidenciasChecado/IncidenciaChecadoConfigAdminService.cs`

**Step 1: Crear la interfaz de administración**

```csharp
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public interface IIncidenciaChecadoConfigAdminService
{
    Task<List<IncidenciaChecadoConfigResponse>> GetAllAsync(CancellationToken ct = default);
    Task<IncidenciaChecadoConfigResponse?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IncidenciaChecadoConfigResponse> CreateAsync(CreateIncidenciaChecadoConfigRequest request, CancellationToken ct = default);
    Task<IncidenciaChecadoConfigResponse?> UpdateAsync(int id, UpdateIncidenciaChecadoConfigRequest request, CancellationToken ct = default);
}
```

**Step 2: Crear la implementación**

```csharp
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public class IncidenciaChecadoConfigAdminService : IIncidenciaChecadoConfigAdminService
{
    private readonly ApplicationDbContext _context;

    public IncidenciaChecadoConfigAdminService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<IncidenciaChecadoConfigResponse>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.IncidenciasChecadoConfig
            .AsNoTracking()
            .OrderByDescending(r => r.Activo)
            .ThenByDescending(r => r.Prioridad)
            .Select(MapToResponse)
            .ToListAsync(ct);
    }

    public async Task<IncidenciaChecadoConfigResponse?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await _context.IncidenciasChecadoConfig
            .AsNoTracking()
            .Where(r => r.IdConfig == id)
            .Select(MapToResponse)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IncidenciaChecadoConfigResponse> CreateAsync(CreateIncidenciaChecadoConfigRequest request, CancellationToken ct = default)
    {
        var entity = new IncidenciaChecadoConfig
        {
            Nombre = request.Nombre.Trim(),
            NombreNormalizado = request.Nombre.Trim(),
            Descripcion = request.Descripcion.Trim(),
            DescripcionNormalizada = request.Descripcion.Trim(),
            TipoIncidencia = request.TipoIncidencia,
            MinutosMin = request.MinutosMin,
            MinutosMax = request.MinutosMax,
            CantidadAcumulada = request.CantidadAcumulada,
            Periodo = request.Periodo,
            Prioridad = request.Prioridad,
            Activo = request.Activo,
        };

        _context.IncidenciasChecadoConfig.Add(entity);
        await _context.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    public async Task<IncidenciaChecadoConfigResponse?> UpdateAsync(int id, UpdateIncidenciaChecadoConfigRequest request, CancellationToken ct = default)
    {
        var entity = await _context.IncidenciasChecadoConfig.FindAsync(new object[] { id }, ct);
        if (entity is null)
            return null;

        entity.Nombre = request.Nombre.Trim();
        entity.NombreNormalizado = request.Nombre.Trim();
        entity.Descripcion = request.Descripcion.Trim();
        entity.DescripcionNormalizada = request.Descripcion.Trim();
        entity.TipoIncidencia = request.TipoIncidencia;
        entity.MinutosMin = request.MinutosMin;
        entity.MinutosMax = request.MinutosMax;
        entity.CantidadAcumulada = request.CantidadAcumulada;
        entity.Periodo = request.Periodo;
        entity.Prioridad = request.Prioridad;
        entity.Activo = request.Activo;

        await _context.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    private static IncidenciaChecadoConfigResponse MapToResponse(IncidenciaChecadoConfig r)
    {
        return new IncidenciaChecadoConfigResponse
        {
            IdConfig = r.IdConfig,
            Nombre = r.Nombre,
            Descripcion = r.Descripcion,
            TipoIncidencia = r.TipoIncidencia,
            MinutosMin = r.MinutosMin,
            MinutosMax = r.MinutosMax,
            CantidadAcumulada = r.CantidadAcumulada,
            Periodo = r.Periodo,
            Prioridad = r.Prioridad,
            Activo = r.Activo,
        };
    }
}
```

**Step 3: Compilar**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`
Expected: SUCCESS

---

## Task 3: Backend Controller

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Rh/IncidenciasChecado/IncidenciasChecadoConfigController.cs`

**Step 1: Crear el controller**

```csharp
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

[ApiController]
[Route("api/rh/incidencias-checado-config")]
[Authorize]
public class IncidenciasChecadoConfigController : ControllerBase
{
    private readonly IIncidenciaChecadoConfigAdminService _service;

    public IncidenciasChecadoConfigController(IIncidenciaChecadoConfigAdminService service)
    {
        _service = service;
    }

    [HttpGet]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<List<IncidenciaChecadoConfigResponse>>>> GetAll(CancellationToken ct)
    {
        var items = await _service.GetAllAsync(ct);
        return Ok(new ApiResponse<List<IncidenciaChecadoConfigResponse>>(items));
    }

    [HttpGet("{id:int}")]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<IncidenciaChecadoConfigResponse>>> GetById(int id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        if (item is null)
            return NotFound(new ApiResponse<IncidenciaChecadoConfigResponse>("Registro no encontrado."));
        return Ok(new ApiResponse<IncidenciaChecadoConfigResponse>(item));
    }

    [HttpPost]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<IncidenciaChecadoConfigResponse>>> Create(
        [FromBody] CreateIncidenciaChecadoConfigRequest request,
        CancellationToken ct)
    {
        var item = await _service.CreateAsync(request, ct);
        return Ok(new ApiResponse<IncidenciaChecadoConfigResponse>(item));
    }

    [HttpPut("{id:int}")]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<IncidenciaChecadoConfigResponse>>> Update(
        int id,
        [FromBody] UpdateIncidenciaChecadoConfigRequest request,
        CancellationToken ct)
    {
        if (id != request.IdConfig)
            return BadRequest(new ApiResponse<IncidenciaChecadoConfigResponse>("El id no coincide con el cuerpo de la petición."));

        var item = await _service.UpdateAsync(id, request, ct);
        if (item is null)
            return NotFound(new ApiResponse<IncidenciaChecadoConfigResponse>("Registro no encontrado."));
        return Ok(new ApiResponse<IncidenciaChecadoConfigResponse>(item));
    }
}
```

**Step 2: Registrar el servicio en DI**

Modify: `lefarma.backend/src/Lefarma.API/Program.cs`
Add after existing service registration:

```csharp
builder.Services.AddScoped<IIncidenciaChecadoConfigAdminService, IncidenciaChecadoConfigAdminService>();
```

**Step 3: Compilar**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`
Expected: SUCCESS

---

## Task 4: Frontend Types

**Files:**
- Modify: `lefarma.frontend/src/types/solicitudPersonal.types.ts`

**Step 1: Agregar los tipos al final del archivo**

```typescript
export interface IncidenciaChecadoConfigResponse {
  idConfig: number;
  nombre: string;
  descripcion: string;
  tipoIncidencia: string;
  minutosMin: number | null;
  minutosMax: number | null;
  cantidadAcumulada: number;
  periodo: string;
  prioridad: number;
  activo: boolean;
}

export interface CreateIncidenciaChecadoConfigRequest {
  nombre: string;
  descripcion: string;
  tipoIncidencia: string;
  minutosMin: number | null;
  minutosMax: number | null;
  cantidadAcumulada: number;
  periodo: string;
  prioridad: number;
  activo: boolean;
}

export interface UpdateIncidenciaChecadoConfigRequest extends CreateIncidenciaChecadoConfigRequest {
  idConfig: number;
}
```

---

## Task 5: Frontend API

**Files:**
- Modify: `lefarma.frontend/src/apps/rh/services/rh.api.ts`

**Step 1: Importar los nuevos tipos**

```typescript
import type {
  // ... existing imports ...
  CreateIncidenciaChecadoConfigRequest,
  IncidenciaChecadoConfigResponse,
  UpdateIncidenciaChecadoConfigRequest,
} from '@/types/solicitudPersonal.types';
```

**Step 2: Agregar el API object**

```typescript
const INCIDENCIAS_CHECADO_CONFIG_ENDPOINT = '/rh/incidencias-checado-config';

export const incidenciaChecadoConfigApi = {
  getAll: () =>
    API.get<ApiResponse<IncidenciaChecadoConfigResponse[]>>(INCIDENCIAS_CHECADO_CONFIG_ENDPOINT),
  getById: (id: number) =>
    API.get<ApiResponse<IncidenciaChecadoConfigResponse>>(`${INCIDENCIAS_CHECADO_CONFIG_ENDPOINT}/${id}`),
  create: (payload: CreateIncidenciaChecadoConfigRequest) =>
    API.post<ApiResponse<IncidenciaChecadoConfigResponse>>(INCIDENCIAS_CHECADO_CONFIG_ENDPOINT, payload),
  update: (id: number, payload: UpdateIncidenciaChecadoConfigRequest) =>
    API.put<ApiResponse<IncidenciaChecadoConfigResponse>>(`${INCIDENCIAS_CHECADO_CONFIG_ENDPOINT}/${id}`, payload),
};
```

**Step 3: Agregar al default export**

```typescript
export default {
  // ... existing ...
  incidenciaChecadoConfigApi,
};
```

---

## Task 6: Frontend Page

**Files:**
- Create: `lefarma.frontend/src/apps/rh/pages/catalogos/IncidenciasChecadoConfigList.tsx`

**Step 1: Crear el componente siguiendo el patrón de `TiposSolicitudList`**

El componente debe incluir:
- `DataTable` con columnas: Nombre, Tipo, Minutos, Cantidad, Periodo, Prioridad, Estado, Acciones.
- Modal con formulario usando `react-hook-form` + `zodResolver` + Zod.
- Selects cerrados para `tipoIncidencia` y `periodo`.
- Campo `activo` como checkbox.
- Botón "Nueva Regla" protegido con `PermissionElement require={['incidencias_checado.crear']}`.
- Llamadas a `incidenciaChecadoConfigApi`.

**Step 2: Validaciones del formulario**

```typescript
const schema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100, 'Máximo 100 caracteres'),
  descripcion: z.string().trim().min(1, 'La descripción es obligatoria').max(500, 'Máximo 500 caracteres'),
  tipoIncidencia: z.string().min(1, 'El tipo de incidencia es obligatorio'),
  minutosMin: z.coerce.number().nullable().optional(),
  minutosMax: z.coerce.number().nullable().optional(),
  cantidadAcumulada: z.coerce.number().min(1, 'Debe ser al menos 1'),
  periodo: z.string().min(1, 'El periodo es obligatorio'),
  prioridad: z.coerce.number().min(0, 'La prioridad no puede ser negativa'),
  activo: z.boolean(),
}).refine((data) => {
  if (data.minutosMin != null && data.minutosMax != null) {
    return data.minutosMin <= data.minutosMax;
  }
  return true;
}, {
  message: 'Minutos min no puede ser mayor que minutos max',
  path: ['minutosMax'],
});
```

**Step 3: Renderizar y conectar handlers**

- `fetchItems`: carga via `incidenciaChecadoConfigApi.getAll()`.
- `handleNuevo`: reset form, abre modal en modo crear.
- `handleEditar`: carga por id, abre modal en modo editar.
- `handleGuardar`: crea o actualiza según modo.

---

## Task 7: Routes

**Files:**
- Modify: `lefarma.frontend/src/routes/AppRoutes.tsx`

**Step 1: Importar la página**

```typescript
import IncidenciasChecadoConfigList from '@/apps/rh/pages/catalogos/IncidenciasChecadoConfigList';
```

**Step 2: Agregar la ruta dentro del grupo `/rh/catalogos`**

```typescript
{
  path: 'catalogos/incidencias-checado-config',
  element: <IncidenciasChecadoConfigList />,
}
```

---

## Task 8: Menu

**Files:**
- Modify: buscar el menú de RH/catalogos (normalmente en `src/components/layout/Menu.tsx`, `src/apps/rh/routes/`, o similar).

**Step 1: Agregar ítem con permiso**

```typescript
{
  label: 'Config. Descuentos Checado',
  path: '/rh/catalogos/incidencias-checado-config',
  permission: 'incidencias_checado.crear',
}
```

---

## Task 9: Build and Verify

**Step 1: Backend build**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`
Expected: SUCCESS

**Step 2: Frontend build (ignorando tests preexistentes)**

Run: `npm run build` en `lefarma.frontend`
Expected: SUCCESS except for unrelated test files.

---

## Notes
- No se agregan tests unitarios por instrucción del usuario.
- El endpoint no expone borrado físico; el desactivado se hace desde el PUT con `activo: false`.
- Los valores permitidos de `tipoIncidencia` y `periodo` deben coincidir con los usados en `IncidenciaChecadoConfigService`.
