# Calendario con Incidencias de Checado - Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar las incidencias de checado en su propio endpoint, pintarlas como badges con modal de detalle en el calendario, y obtener el usuario autenticado desde el backend para los endpoints de calendario.

**Architecture:** El backend expone tres endpoints independientes: solicitudes de personal, días laborales e incidencias de checado. Los dos últimos leen `idUsuario` de claims. El frontend consume los tres en paralelo y pinta cada incidencia como un badge con ícono de alerta; al hacer clic abre un modal con el detalle.

**Nota sobre el endpoint:** No es necesario crear un endpoint nuevo. Ya existe `/api/rh/incidencias-checado`; solo hay que adaptarlo para recibir `anio`/`mes`, derivar `idUsuario` de claims y devolver las incidencias del mes. Reutilizarlo evita duplicar la lógica de resolución `idUsuario → correo → nómina`.

**Tech Stack:** .NET 10 Web API, React 19 + Vite + TypeScript, shadcn/ui, fetch directo con axios.

---

### Task 1: Backend - Limpiar `/calendario/laboral` de incidencias

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/Calendario/DTOs/CalendarioDtos.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/Calendario/CalendarioService.cs`

**Step 1: Quitar campos de incidencia del DTO**

En `CalendarioDtos.cs`, dejar `CalendarioLaboralResponse` solo con:
```csharp
public class CalendarioLaboralResponse
{
    public DateTime Fecha { get; set; }
    public string? NombreDiaSemana { get; set; }
    public string? NombreMes { get; set; }
    public bool Laborable { get; set; }
}
```

**Step 2: Quitar lógica de incidencias del servicio**

En `CalendarioService.cs`, eliminar la inyección de `IIncidenciasChecadoRepository` y todo el bloque que consulta y asigna incidencias a los días. Dejar solo la llamada a `_repository.ObtenerCalendarioLaboralAsync(request)` y el logging básico.

---

### Task 2: Backend - `/api/rh/incidencias-checado` con usuario desde claims

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/IncidenciasChecado/IncidenciasChecadoController.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/IncidenciasChecado/DTOs/IncidenciasChecadoDtos.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/IncidenciasChecado/IncidenciasChecadoService.cs`

**Step 1: Cambiar request para recibir anio/mes**

En `IncidenciasChecadoDtos.cs`, reemplazar `IncidenciasChecadoRequest` por:
```csharp
public class IncidenciasChecadoRequest
{
    public int? Anio { get; set; }
    public int? Mes { get; set; }
    public DateTime? FechaDesde { get; set; }
    public DateTime? FechaHasta { get; set; }
    public TimeSpan? HoraEntradaDesde { get; set; }
    public TimeSpan? HoraEntradaHasta { get; set; }
    public TimeSpan? HoraSalidaDesde { get; set; }
    public TimeSpan? HoraSalidaHasta { get; set; }
    public string? Nombre { get; set; }
    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
}
```

**Step 2: Controller lee idUsuario de claims y calcula rango**

En `IncidenciasChecadoController.cs`, en el método `Get`, antes de llamar al servicio:
1. Leer `idUsuarioClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value`.
2. Convertir a `int idUsuario`.
3. Si `request.Anio` y `request.Mes` tienen valor, calcular `FechaDesde` y `FechaHasta` como inicio y fin de mes.
4. Asignar `request.IdUsuario` internamente (se puede usar una variable local o añadir `IdUsuario` al request como propiedad interna; lo más simple es pasar `idUsuario` como parámetro adicional al servicio).

**Step 3: Service recibe idUsuario y lo pasa al repositorio**

Cambiar la firma de `GetAsync` para recibir `int idUsuario`:
```csharp
public async Task<ErrorOr<List<IncidenciaChecadoResponse>>> GetAsync(
    IncidenciasChecadoRequest request,
    int idUsuario,
    CancellationToken cancellationToken = default)
```

Antes de llamar al repositorio, asignar:
```csharp
request.FechaDesde = new DateTime(request.Anio.Value, request.Mes.Value, 1);
request.FechaHasta = request.FechaDesde.Value.AddMonths(1).AddDays(-1);
```

Luego llamar `_repository.GetAsync(request, idUsuario, cancellationToken)`.

**Step 4: Actualizar repositorio para recibir idUsuario directamente**

Modificar `IIncidenciasChecadoRepository.GetAsync` para recibir `int idUsuario` y resolver la nómina internamente en lugar de leer `request.IdUsuario`.

---

### Task 3: Backend - `/solicitudes-personal/calendario` con usuario desde claims

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/SolicitudesPersonal/CalendarioController.cs` (o el controlador que expone `/solicitudes-personal/calendario`)
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/SolicitudesPersonal/SolicitudPersonalService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Rh/SolicitudesPersonal/DTOs/CalendarioDtos.cs` (si existe; si no, buscar el DTO de request)

**Step 1: Localizar el endpoint**

Buscar el controlador que tiene `[Route("solicitudes-personal/calendario")]` o similar. Ajustar las rutas de archivo según lo encontrado.

**Step 2: Quitar `idUsuarioCreador` del request DTO**

Eliminar la propiedad `idUsuarioCreador` del request de calendario de solicitudes.

**Step 3: Controller lee idUsuario de claims**

En el método `Get`, leer `idUsuario` de `ClaimTypes.NameIdentifier` y pasarlo al servicio.

**Step 4: Service filtra por idUsuario internamente**

En el servicio que resuelve `/solicitudes-personal/calendario`, aplicar el filtro por `idUsuarioCreador = idUsuario` en lugar de leerlo del request.

---

### Task 4: Frontend - Actualizar tipos y crear API de incidencias

**Files:**
- Modify: `lefarma.frontend/src/types/solicitudPersonal.types.ts`
- Modify: `lefarma.frontend/src/apps/rh/services/misLimites.api.ts`

**Step 1: Agregar tipo de incidencia**

Añadir en `solicitudPersonal.types.ts`:
```typescript
export interface IncidenciaChecadoResponse {
  fecha: string;
  nomina?: number | null;
  nombre?: string | null;
  empresa?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  checa?: string | null;
  nombreDiaSemana?: string | null;
  diaSemana?: number | null;
  turno?: string | null;
  horario?: string | null;
  entrada?: string | null;
  salida?: string | null;
  entro?: string | null;
  salio?: string | null;
  msgError?: string | null;
  incidenciaEntrada?: string | null;
  incidenciaSalida?: string | null;
}
```

**Step 2: Limpiar `CalendarioLaboralResponse`**

Dejar solo:
```typescript
export interface CalendarioLaboralResponse {
  fecha: string;
  nombreDiaSemana?: string | null;
  nombreMes?: string | null;
  laborable: boolean;
}
```

**Step 3: Quitar `idUsuarioCreador` de `CalendarioGlobalRequest`**

Eliminar `idUsuarioCreador?: number;` del request.

**Step 4: Crear API de incidencias**

En `misLimites.api.ts` añadir:
```typescript
export const incidenciasChecadoApi = {
  get: (request: { anio: number; mes: number }) =>
    API.get<ApiResponse<IncidenciaChecadoResponse[]>>('/rh/incidencias-checado', {
      params: request,
    }),
};
```

Importar `IncidenciaChecadoResponse` en el archivo.

---

### Task 5: Frontend - Actualizar `MiCalendario.tsx` para 3 endpoints

**Files:**
- Modify: `lefarma.frontend/src/apps/rh/components/MiCalendario.tsx`

**Step 1: Actualizar imports**
- Importar `incidenciasChecadoApi` desde `../services/misLimites.api`.
- Importar `IncidenciaChecadoResponse` desde tipos.
- Quitar `useAuthStore` si ya no se usa para `idUsuario`.

**Step 2: Actualizar hook `useCalendario`**
- Agregar estado `incidencias` de tipo `IncidenciaChecadoResponse[]`.
- En `fetchCalendario`, cambiar `Promise.all` para llamar a 3 APIs:
```typescript
const [calRes, nolabRes, incRes] = await Promise.all([
  calendarioApi.get({ anio, mes, estados: ['CERRADA'] }),
  calendarioLaboralApi.get({ anio, mes }).catch(() => null),
  incidenciasChecadoApi.get({ anio, mes }).catch(() => null),
]);
```
- Guardar `incRes.data.data ?? []` en el estado.
- Eliminar `user?.id` de las dependencias del `useEffect`.

**Step 3: Indexar incidencias por fecha**

En el `useMemo` que construye `dias`:
```typescript
const incidenciasPorFecha = new Map<string, IncidenciaChecadoResponse>();
incidencias.forEach((i) => {
  const key = new Date(i.fecha).toISOString().split('T')[0];
  incidenciasPorFecha.set(key, i);
});
```

Añadir `incidencia?: IncidenciaChecadoResponse` a `DiaCelda` y asignarla en cada celda.

**Step 4: Crear `IncidenciaBadge`**

Componente que recibe `incidencia` y `onClick`:
```typescript
function IncidenciaBadge({ incidencia, onClick }: { incidencia: IncidenciaChecadoResponse; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 flex w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors hover:brightness-95',
        'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span className="truncate">Incidencia</span>
    </button>
  );
}
```

**Step 5: Crear `IncidenciaModal`**

Modal pequeño que recibe `incidencia` y `onClose`:
- Título: "Incidencia de checado" con ícono `AlertTriangle`.
- Fecha y día de la semana.
- Incidencia de entrada (si existe).
- Incidencia de salida (si existe).
- Mensaje de error (si existe).
- Grid con horarios: entrada, salida, entró, salió.

**Step 6: Pintar incidencias en la celda**

En el renderizado de cada día, después de los eventos de solicitud o en una sección separada, renderizar:
```typescript
{dia.incidencia && (
  <IncidenciaBadge
    incidencia={dia.incidencia}
    onClick={() => setIncidenciaSeleccionada(dia.incidencia)}
  />
)}
```

Mantener el límite visual con los eventos (máximo 3 items en total por celda, o manejar por separado).

**Step 7: Eliminar popover antiguo de incidencias**

Borrar el componente `IncidenciaBadge` anterior (el del popover) y toda referencia a `dia.incidencia` con popover.

**Step 8: Renderizar modal**

Añadir al final del JSX:
```typescript
<IncidenciaModal
  incidencia={incidenciaSeleccionada}
  open={incidenciaSeleccionada !== null}
  onClose={() => setIncidenciaSeleccionada(null)}
/>
```

---

### Task 6: Pruebas manuales sugeridas

1. Abrir el calendario con un usuario que tenga incidencias: debe aparecer el badge amarillo con ícono de alerta.
2. Clic en el badge: abre modal con detalle de la incidencia.
3. Verificar que `/calendario/laboral` ya no retorna campos de incidencia.
4. Verificar que `/solicitudes-personal/calendario` funciona sin enviar `idUsuarioCreador`.
5. Verificar que `/api/rh/incidencias-checado` solo retorna incidencias del usuario logueado.
