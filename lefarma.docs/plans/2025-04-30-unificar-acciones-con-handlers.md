# Enriquecer /acciones con Handlers y Pre-cargar Workflows Ligeros

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimizar `AutorizacionesOC` enriqueciendo `/ordenes/{id}/acciones` con handlers/campos para eliminar `accionesConfig`, y creando un endpoint ligero `/config/workflows/flow` que precarga todos los workflows al iniciar la página (solo datos necesarios para el flujo visual).

**Architecture:** 
- Backend: Nuevo endpoint `GET /config/workflows/flow` devuelve workflows activos con pasos mínimos (sin handlers, campos, condiciones ni relaciones pesadas). El endpoint `/ordenes/{id}/acciones` se enriquece con handlers/campos de cada acción usando `idWorkflow` de la orden.
- Frontend: Al montar `AutorizacionesOC`, llama una sola vez a `/config/workflows/flow`, cachea todos los workflows en memoria, y nunca más vuelve a llamar al backend para el flujo visual.

**Tech Stack:** .NET 10, EF Core, React 19 + TypeScript

---

## Contexto

### Problema actual
1. `GET /ordenes/{id}` → datos de la orden
2. `GET /ordenes/{id}/acciones` → solo tipo de acción (sin handlers)
3. `GET /ordenes/{id}/historial-workflow` → bitácora
4. `GET /config/workflows/{idWorkflow}` → **trae TODO** (handlers, campos, condiciones, notificaciones...) solo para pintar la barra de progreso

### Solución propuesta
1. `GET /config/workflows/flow` → **una sola vez al iniciar**, trae todos los workflows activos con solo pasos mínimos (id, orden, nombre, esFinal, etc.)
2. `GET /ordenes/{id}` → datos de la orden
3. `GET /ordenes/{id}/acciones` → **enriquecido** con handlers, campos y requisitos del paso
4. `GET /ordenes/{id}/historial-workflow` → bitácora

**Resultado:** De 4 llamadas por orden a **3 llamadas**, y la primera (`/config/workflows/flow`) solo se ejecuta **una vez por sesión**.

---

### Task 1: Crear endpoint ligero `GET /config/workflows/flow`

**Files:**
- Create: `lefarma.backend/src/Lefarma.API/Features/Config/Workflows/DTOs/WorkflowFlowDTOs.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Config/Workflows/IWorkflowService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Config/Workflows/WorkflowService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Config/Workflows/WorkflowsController.cs`

**Step 1: Crear DTOs ligeros**

```csharp
namespace Lefarma.API.Features.Config.Workflows.DTOs
{
    public class WorkflowFlowResponse
    {
        public int IdWorkflow { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string CodigoProceso { get; set; } = string.Empty;
        public int Version { get; set; }
        public bool Activo { get; set; }
        public List<WorkflowPasoFlowResponse> Pasos { get; set; } = new();
    }

    public class WorkflowPasoFlowResponse
    {
        public int IdPaso { get; set; }
        public int Orden { get; set; }
        public string NombrePaso { get; set; } = string.Empty;
        public int? IdEstado { get; set; }
        public string? DescripcionAyuda { get; set; }
        public bool EsInicio { get; set; }
        public bool EsFinal { get; set; }
        public bool Activo { get; set; }
        public bool RequiereFirma { get; set; }
        public bool RequiereComentario { get; set; }
        public bool RequiereAdjunto { get; set; }
        public bool PermiteAdjunto { get; set; }
    }
}
```

**Step 2: Agregar método a interfaz**

```csharp
public interface IWorkflowService
{
    Task<ErrorOr<IEnumerable<WorkflowResponse>>> GetAllAsync(WorkflowRequest query);
    Task<ErrorOr<WorkflowResponse>> GetByIdAsync(int id);
    Task<ErrorOr<WorkflowResponse>> GetByCodigoProcesoAsync(string codigoProceso);
    
    // NUEVO: Endpoint ligero para flujo visual
    Task<ErrorOr<IEnumerable<WorkflowFlowResponse>>> GetAllFlowAsync();
    
    // ... resto de métodos
}
```

**Step 3: Implementar en WorkflowService**

```csharp
public async Task<ErrorOr<IEnumerable<WorkflowFlowResponse>>> GetAllFlowAsync()
{
    try
    {
        var workflows = await _repo.GetQueryable()
            .Where(w => w.Activo)
            .Include(w => w.Pasos)
            .OrderBy(w => w.Nombre)
            .ToListAsync();

        var response = workflows.Select(w => new WorkflowFlowResponse
        {
            IdWorkflow = w.IdWorkflow,
            Nombre = w.Nombre,
            CodigoProceso = w.CodigoProceso,
            Version = w.Version,
            Activo = w.Activo,
            Pasos = w.Pasos
                .Where(p => p.Activo)
                .OrderBy(p => p.Orden)
                .Select(p => new WorkflowPasoFlowResponse
                {
                    IdPaso = p.IdPaso,
                    Orden = p.Orden,
                    NombrePaso = p.NombrePaso,
                    IdEstado = p.IdEstado,
                    DescripcionAyuda = p.DescripcionAyuda,
                    EsInicio = p.EsInicio,
                    EsFinal = p.EsFinal,
                    Activo = p.Activo,
                    RequiereFirma = p.RequiereFirma,
                    RequiereComentario = p.RequiereComentario,
                    RequiereAdjunto = p.RequiereAdjunto,
                    PermiteAdjunto = p.PermiteAdjunto
                }).ToList()
        }).ToList();

        return response;
    }
    catch (Exception ex)
    {
        EnrichWideEvent("GetAllFlow", exception: ex);
        return CommonErrors.DatabaseError("obtener workflows para flujo");
    }
}
```

**Step 4: Agregar controller endpoint**

```csharp
[HttpGet("flow")]
public async Task<IActionResult> GetAllFlow()
{
    var result = await _service.GetAllFlowAsync();
    return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<WorkflowFlowResponse>>
    {
        Success = true,
        Message = "Workflows obtenidos correctamente.",
        Data = data
    }));
}
```

**Step 5: Build**

```bash
cd lefarma.backend
dotnet build "01-lefarma-project.sln"
```
Expected: `Compilación correcta.`

**Step 6: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/Config/Workflows/DTOs/WorkflowFlowDTOs.cs
git add lefarma.backend/src/Lefarma.API/Features/Config/Workflows/IWorkflowService.cs
git add lefarma.backend/src/Lefarma.API/Features/Config/Workflows/WorkflowService.cs
git add lefarma.backend/src/Lefarma.API/Features/Config/Workflows/WorkflowsController.cs
git commit -m "feat(workflow): add lightweight /config/workflows/flow endpoint for visual flow"
```

---

### Task 2: Extender DTO `AccionDisponibleResponse`

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/DTOs/FirmasDTOs.cs:21-28`

**Step 1: Agregar propiedades faltantes**

```csharp
public class AccionDisponibleResponse
{
    public int IdAccion { get; set; }
    public int IdTipoAccion { get; set; }
    public string? TipoAccionCodigo { get; set; }
    public string? TipoAccionNombre { get; set; }
    public bool? TipoAccionCambiaEstado { get; set; }
    
    // NUEVO: Handlers y campos para construir el modal dinámico
    public List<AccionHandlerMetadataResponse> Handlers { get; set; } = new();
    public List<WorkflowCampoMetadataResponse> CamposWorkflow { get; set; } = new();
    public List<string> CamposRequeridos { get; set; } = new();
    
    // NUEVO: Requisitos del paso origen
    public bool RequiereComentario { get; set; }
    public bool RequiereAdjunto { get; set; }
    public bool PermiteAdjunto { get; set; }
}
```

**Step 2: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/DTOs/FirmasDTOs.cs
git commit -m "feat(firmas): extend AccionDisponibleResponse with handlers, campos and paso requirements"
```

---

### Task 3: Agregar sobrecarga `GetAccionesDisponiblesAsync(int idWorkflow, ...)`

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Domain/Interfaces/Config/IWorkflowEngine.cs:9`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Config/Engine/WorkflowEngine.cs:119-163`

**Step 1: Extender interfaz**

```csharp
public interface IWorkflowEngine
{
    Task<WorkflowEjecucionResult> EjecutarAccionAsync(WorkflowContext context);
    Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(string codigoProceso, int idOrden, int idUsuario);
    
    // NUEVO: Sobrecarga por idWorkflow
    Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(int idWorkflow, int idOrden, int idUsuario);
}
```

**Step 2: Implementar sobrecarga en WorkflowEngine**

```csharp
public async Task<ICollection<WorkflowAccion>> GetAccionesDisponiblesAsync(
    int idWorkflow, int idOrden, int idUsuario)
{
    var orden = await _context.OrdenesCompra.FindAsync(idOrden);
    if (orden?.IdPasoActual is null) return Array.Empty<WorkflowAccion>();

    var acciones = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
    var workflow = await _workflowRepo.GetByIdAsync(idWorkflow);
    var pasoActual = workflow?.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual.Value);
    if (pasoActual is null || !pasoActual.Activo) return Array.Empty<WorkflowAccion>();

    // Cuando el paso usa condiciones para enrutar la aprobación (ej. Firma 4 por monto),
    // se expone una sola acción "Autorizar" para evitar duplicados en UI.
    if (pasoActual?.Condiciones.Any() == true)
    {
        var aprobaciones = acciones
            .Where(a => a.TipoAccion != null && a.TipoAccion.Codigo == "APROBAR")
            .OrderBy(a => a.IdAccion)
            .ToList();

        if (aprobaciones.Count > 1)
        {
            var accionBase = aprobaciones.First();
            var autorizacionUnica = new WorkflowAccion
            {
                IdAccion = accionBase.IdAccion,
                IdPasoOrigen = accionBase.IdPasoOrigen,
                IdPasoDestino = accionBase.IdPasoDestino,
                IdTipoAccion = accionBase.IdTipoAccion
            };

            var restantes = acciones
                .Where(a => a.TipoAccion == null || a.TipoAccion.Codigo != "APROBAR")
                .OrderBy(a => a.IdAccion)
                .ToList();

            return new List<WorkflowAccion> { autorizacionUnica }
                .Concat(restantes)
                .ToList();
        }
    }

    return acciones;
}
```

**Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Domain/Interfaces/Config/IWorkflowEngine.cs
git add lefarma.backend/src/Lefarma.API/Features/Config/Engine/WorkflowEngine.cs
git commit -m "feat(engine): add GetAccionesDisponiblesAsync overload by idWorkflow"
```

---

### Task 4: Modificar `FirmasService.GetAccionesAsync` para usar `idWorkflow` y devolver handlers/campos

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/FirmasService.cs:143-165`

**Step 1: Reemplazar implementación**

```csharp
public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesAsync(int idOrden, int idUsuario)
{
    try
    {
        var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
        if (orden is null)
            return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());
        
        if (!orden.IdWorkflow.HasValue)
            return CommonErrors.Conflict("orden", "La orden no tiene workflow asignado.");

        var acciones = await _engine.GetAccionesDisponiblesAsync(orden.IdWorkflow.Value, idOrden, idUsuario);
        if (!acciones.Any())
            return CommonErrors.NotFound("Accion");

        var workflow = await _workflowRepo.GetByIdAsync(orden.IdWorkflow.Value);
        var pasoActual = workflow?.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual);
        
        // Obtener campos del workflow una sola vez
        var camposWorkflow = (await _workflowRepo.GetCamposByWorkflowAsync(orden.IdWorkflow.Value)).ToList();

        var result = new List<AccionDisponibleResponse>();
        foreach (var a in acciones)
        {
            var handlers = (await _workflowRepo.GetAccionHandlersAsync(a.IdAccion)).ToList();
            var camposRequeridos = handlers
                .Where(h => h.Requerido && h.Campo != null)
                .Select(h => h.Campo!.NombreTecnico)
                .ToList();

            result.Add(new AccionDisponibleResponse
            {
                IdAccion = a.IdAccion,
                IdTipoAccion = a.IdTipoAccion,
                TipoAccionCodigo = a.TipoAccion != null ? a.TipoAccion.Codigo : null,
                TipoAccionNombre = a.TipoAccion != null ? a.TipoAccion.Nombre : null,
                TipoAccionCambiaEstado = a.TipoAccion != null ? a.TipoAccion.CambiaEstado : null,
                Handlers = handlers.Select(h => new AccionHandlerMetadataResponse
                {
                    IdHandler = h.IdHandler,
                    HandlerKey = h.HandlerKey,
                    Requerido = h.Requerido,
                    ConfiguracionJson = h.ConfiguracionJson,
                    OrdenEjecucion = h.OrdenEjecucion
                }).ToList(),
                CamposWorkflow = camposWorkflow.Select(c => new WorkflowCampoMetadataResponse
                {
                    IdWorkflowCampo = c.IdWorkflowCampo,
                    NombreTecnico = c.NombreTecnico,
                    EtiquetaUsuario = c.EtiquetaUsuario,
                    TipoControl = c.TipoControl,
                    SourceCatalog = c.SourceCatalog
                }).ToList(),
                CamposRequeridos = camposRequeridos,
                RequiereComentario = pasoActual?.RequiereComentario ?? false,
                RequiereAdjunto = pasoActual?.RequiereAdjunto ?? false,
                PermiteAdjunto = pasoActual?.PermiteAdjunto ?? false
            });
        }

        return result;
    }
    catch (Exception ex)
    {
        EnrichWideEvent("GetAcciones", entityId: idOrden, exception: ex);
        return CommonErrors.DatabaseError("obtener las acciones disponibles");
    }
}
```

**Step 2: Build**

```bash
cd lefarma.backend
dotnet build "01-lefarma-project.sln"
```
Expected: `Compilación correcta.`

**Step 3: Commit**

```bash
git add lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/FirmasService.cs
git commit -m "feat(firmas): GetAccionesAsync now returns handlers, campos and uses idWorkflow from orden"
```

---

### Task 5: Actualizar Frontend - Precargar workflows y usar /acciones enriquecido

**Files:**
- Modify: `lefarma.frontend/src/pages/ordenes/AutorizacionesOC.tsx`

**Step 1: Crear tipos para el endpoint ligero**

```typescript
interface WorkflowFlowResponse {
  idWorkflow: number;
  nombre: string;
  codigoProceso: string;
  version: number;
  activo: boolean;
  pasos: WorkflowPasoFlowResponse[];
}

interface WorkflowPasoFlowResponse {
  idPaso: number;
  orden: number;
  nombrePaso: string;
  idEstado?: number;
  descripcionAyuda?: string;
  esInicio: boolean;
  esFinal: boolean;
  activo: boolean;
  requiereFirma: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto: boolean;
}
```

**Step 2: Actualizar `AccionDisponibleResponse` interface**

```typescript
interface AccionDisponibleResponse {
  idAccion: number;
  idTipoAccion: number;
  tipoAccionCodigo?: string;
  tipoAccionNombre?: string;
  tipoAccionCambiaEstado?: boolean;
  
  // NUEVO: Requisitos del paso
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto: boolean;
  
  // NUEVO: Handlers y campos para modal dinámico
  handlers: AccionHandlerResponse[];
  camposWorkflow: WorkflowCampoResponse[];
  camposRequeridos: string[];
}
```

**Step 3: Agregar estado global para workflows precargados**

```typescript
// Reemplazar estados relacionados a workflow:
const [workflowsMap, setWorkflowsMap] = useState<Map<number, WorkflowFlowResponse>>(new Map());
const [pasosWorkflow, setPasosWorkflow] = useState<WorkflowPasoFlowResponse[]>([]);

// ELIMINAR (ya no se necesitan):
// const [accionesConfig, setAccionesConfig] = useState<Map<number, WorkflowAccionConfig>>(new Map());
// const [workflowCampos, setWorkflowCampos] = useState<WorkflowCampoConfig[]>([]);
```

**Step 4: Crear función para precargar workflows**

```typescript
const fetchAllWorkflowsFlow = async () => {
  try {
    const res = await API.get<ApiResponse<WorkflowFlowResponse[]>>('/config/workflows/flow');
    if (res.data?.success && res.data.data) {
      const map = new Map<number, WorkflowFlowResponse>();
      for (const w of res.data.data) {
        map.set(w.idWorkflow, w);
      }
      setWorkflowsMap(map);
    }
  } catch {
    setWorkflowsMap(new Map());
  }
};
```

**Step 5: Actualizar useEffect inicial**

```typescript
useEffect(() => {
  fetchEstados();
  fetchOrdenes();
  fetchAllWorkflowsFlow(); // PRECARGAR TODOS LOS WORKFLOWS
}, []);
```

**Step 6: Actualizar useEffect cuando cambia selectedOrden**

```typescript
useEffect(() => {
  if (!selectedOrden) {
    setPasosWorkflow([]);
    return;
  }
  
  setExpandedPasoId(selectedOrden.idPasoActual ?? null);
  setExpandedPartidaId(selectedOrden.partidas[0]?.idPartida ?? null);
  
  // Obtener pasos del workflow desde cache (ya precargado)
  if (selectedOrden.idWorkflow) {
    const workflow = workflowsMap.get(selectedOrden.idWorkflow);
    if (workflow) {
      setPasosWorkflow(workflow.pasos.filter(p => p.activo).sort((a, b) => a.orden - b.orden));
    }
  }
}, [selectedOrden, workflowsMap]);
```

**Step 7: Simplificar `abrirModalFirma` y eliminar dependencia de accionesConfig**

```typescript
const abrirModalFirma = (accion: AccionDisponibleResponse) => {
  setAccionSeleccionada(accion);
  const campos = getCamposParaAccion(accion);
  setModalFirma(true);
};

function getCamposParaAccion(accion: AccionDisponibleResponse | null): CampoFormItem[] {
  if (!accion) return [];
  const result: CampoFormItem[] = [];
  const seen = new Set<string>();

  const handlers = [...(accion.handlers || [])]
    .sort((a, b) => a.ordenEjecucion - b.ordenEjecucion);

  for (const handler of handlers) {
    try {
      if (handler.handlerKey === 'Field' && handler.campo) {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({ campo: handler.campo, requerido: handler.requerido, inputKey });
        }
      }

      if (handler.handlerKey === 'Document' && handler.campo) {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({ campo: handler.campo, requerido: handler.requerido, inputKey });
        }
      }
    } catch {
      /* handler sin campo o JSON inválido */
    }
  }
  return result;
}
```

**Step 8: Actualizar renderizado del modal**

```typescript
const esRechazo = accionSeleccionada?.tipoAccionCodigo === 'RECHAZAR';
const esRetorno = accionSeleccionada?.tipoAccionCodigo === 'DEVOLVER';

const requiereComentario = accionSeleccionada?.requiereComentario ?? false;
const requiereAdjunto = accionSeleccionada?.requiereAdjunto ?? false;
const permiteAdjunto = accionSeleccionada?.permiteAdjunto ?? false;
```

**Step 9: Eliminar `fetchPasosWorkflow` si ya no se usa en ningún otro lado**

```typescript
// ELIMINAR función completa si no se usa en otros componentes/modales
```

**Step 10: Lint + Build frontend**

```bash
cd lefarma.frontend
npm run lint
npm run build
```

**Step 11: Commit**

```bash
git add lefarma.frontend/src/pages/ordenes/AutorizacionesOC.tsx
git commit -m "refactor(autorizaciones): preload all workflows on mount, use enriched /acciones endpoint"
```

---

### Task 6: Verificación E2E

**Step 1: Iniciar backend**

```bash
cd lefarma.backend/src/Lefarma.API
dotnet run
```

**Step 2: Iniciar frontend**

```bash
cd lefarma.frontend
npm run dev
```

**Step 3: Probar flujo**
1. Abrir DevTools → Network tab
2. Ir a AutorizacionesOC
3. Verificar que al cargar la página se hace **una sola llamada** a `/config/workflows/flow`
4. Seleccionar una orden en paso activo
5. Verificar que los botones de acción aparecen con su nombre correcto
6. Click en "Autorizar" → modal se abre con campos dinámicos correctos
7. Completar y confirmar → orden avanza de paso
8. Seleccionar otra orden del **mismo workflow** → verificar que NO hay llamada adicional a workflows
9. Seleccionar orden de **otro workflow** → verificar que NO hay llamada adicional (porque ya se precargó todo)

**Step 4: Commit final**

```bash
git commit --allow-empty -m "test: verify preloaded workflows and enriched /acciones endpoint"
```

---

## Resumen de Cambios

### Backend

| Archivo | Cambio |
|---------|--------|
| `WorkflowFlowDTOs.cs` (nuevo) | DTOs ligeros `WorkflowFlowResponse` y `WorkflowPasoFlowResponse` |
| `IWorkflowService.cs` | Nuevo método `GetAllFlowAsync()` |
| `WorkflowService.cs` | Implementación de `GetAllFlowAsync()` con query ligera |
| `WorkflowsController.cs` | Nuevo endpoint `GET /config/workflows/flow` |
| `FirmasDTOs.cs` | `AccionDisponibleResponse` ahora incluye `Handlers`, `CamposWorkflow`, `CamposRequeridos`, `RequiereComentario`, `RequiereAdjunto`, `PermiteAdjunto` |
| `IWorkflowEngine.cs` | Nueva sobrecarga `GetAccionesDisponiblesAsync(int idWorkflow, ...)` |
| `WorkflowEngine.cs` | Implementación de la sobrecarga |
| `FirmasService.cs` | `GetAccionesAsync` usa `orden.IdWorkflow`, devuelve handlers/campos |

### Frontend

| Cambio | Descripción |
|--------|-------------|
| Precarga workflows | `fetchAllWorkflowsFlow()` se ejecuta una vez al montar el componente |
| Cache en memoria | `workflowsMap: Map<number, WorkflowFlowResponse>` almacena todos los workflows |
| Flujo visual | Usa `workflowsMap` directamente, sin llamadas adicionales al backend |
| Modal de firma | Usa datos enriquecidos de `/acciones`, elimina dependencia de `accionesConfig` |

### Métricas de mejora

| Escenario | Antes | Después |
|-----------|-------|---------|
| Carga inicial de página | 1 llamada (`fetchOrdenes`) | 2 llamadas (`fetchOrdenes` + `fetchAllWorkflowsFlow`) |
| Seleccionar primera orden | +3 llamadas (orden + acciones + historial + workflow) | +3 llamadas (orden + acciones-enriquecidas + historial) |
| Seleccionar siguientes órdenes | +3-4 llamadas por orden | +3 llamadas por orden (workflow ya está en memoria) |
| Cambiar entre workflows | Recarga workflow completo | Sin recarga (todo precargado) |

