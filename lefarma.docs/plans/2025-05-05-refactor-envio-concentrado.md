# Plan: Refactorizar Envío Concentrado — Usar estado del workflow en lugar de paso fijo

## Contexto

Actualmente `EnvioConcentrado.tsx` filtra órdenes del paso 4 (`idPasoActual === 4`) y `FirmasService.cs` ejecuta la acción hardcodeada `ACCION_AUTORIZAR_PASO4 = 8`.

El objetivo es desacoplar el envío concentrado del número de paso, usando el estado del workflow (`id_estado`) y la acción `envia_concentrado = true`.

---

## Nuevo flujo

```
Paso X (ej: GAF)
  └─ Acción AUTORIZAR con envia_concentrado = true
        └─ id_paso_destino = Paso Y (Director)
        
AutorizacionesOC.tsx: la acción con envia_concentrado está OCULTA
EnvioConcentrado.tsx: muestra órdenes con estado del Paso X (filtrando por idEstado)
  └─ Usuario selecciona órdenes y presiona "Enviar"
        └─ Backend ejecuta FirmarAsync con la acción del paso actual (buscando la que tenga envia_concentrado)
              └─ Orden avanza al Paso Y (Director)
```

### Reglas de negocio
1. **Acciones con `envia_concentrado = true` NO se muestran en `AutorizacionesOC.tsx`**
   - El creador de la orden sí puede ver otras acciones en el paso inicial (`es_inicio`)
   - Pero la acción con `envia_concentrado` solo se ejecuta desde `EnvioConcentrado.tsx`

2. **EnvioConcentrado.tsx filtra por `idEstado`, no por `idPasoActual`**
   - Se configura un estado de workflow identificable (ej. `EN_REVISION_GAF`) asignado al paso X
   - El frontend consulta `/ordenes?idEstado=XX`
   - Ya no depende del número de paso

3. **EnvioConcentradoAsync ejecuta `FirmarAsync` dinámicamente**
   - Busca la acción del paso actual que tenga `envia_concentrado = true`
   - Ejecuta esa acción para cada orden seleccionada
   - Elimina el `private const int ACCION_AUTORIZAR_PASO4 = 8`

---

## Cambios requeridos

### 1. Frontend — Ocultar acciones con envia_concentrado en AutorizacionesOC.tsx

**Archivo:** `lefarma.frontend/src/pages/ordenes/AutorizacionesOC.tsx`

**Ubicación:** Línea ~1700, donde se renderizan los botones de acciones.

**Cambio:** Filtrar acciones para excluir las que tienen `envia_concentrado = true`:

```tsx
// Antes:
{acciones.map((a) => (
  <Button key={a.idAccion} ...>
    {a.tipoAccionNombre}
  </Button>
))}

// Después:
{acciones
  .filter(a => !a.enviaConcentrado)
  .map((a) => (
    <Button key={a.idAccion} ...>
      {a.tipoAccionNombre}
    </Button>
  ))}
```

**Mensaje vacío ajustado:**
```tsx
{acciones.filter(a => !a.enviaConcentrado).length === 0 ? (
  <p>No hay acciones disponibles para su usuario en este paso.</p>
) : ...}
```

> **Nota:** El campo `enviaConcentrado` ya existe en `AccionDisponibleResponse` del backend (lo agregamos en commits anteriores), pero el frontend quizás no lo esté recibiendo. Verificar que el DTO del backend lo incluya.

### 2. Backend — Incluir enviaConcentrado en AccionDisponibleResponse

**Archivo:** `lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/DTOs/FirmasDTOs.cs` (o donde esté `AccionDisponibleResponse`)

**Verificación:** Asegurar que `AccionDisponibleResponse` tenga:
```csharp
public bool EnviaConcentrado { get; set; }
```

Y que `GetAccionesAsync` en `FirmasService.cs` lo mapee desde `a.EnviaConcentrado`.

### 3. Frontend — EnvioConcentrado.tsx filtra por estado

**Archivo:** `lefarma.frontend/src/pages/ordenes/EnvioConcentrado.tsx`

**Cambio 1: Constante configurable**
```typescript
// ID del estado que representa "pendiente de envío concentrado"
// Se configura según el workflow. Ejemplo: estado EN_REVISION_GAF = 4
const ESTADO_ENVIO_CONCENTRADO = 4; // TODO: Obtener de configuración o API
```

**Cambio 2: fetchOrdenes**
```typescript
const fetchOrdenes = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await API.get<ApiResponse<OrdenCompraResponse[]>>(
      `/ordenes?idEstado=${ESTADO_ENVIO_CONCENTRADO}`
    );
    setOrdenes(res.data.data ?? []);
  } catch {
    setError('No se pudieron cargar las órdenes pendientes de envío concentrado.');
  } finally {
    setLoading(false);
  }
};
```

**Cambio 3: Mensaje vacío**
```tsx
ordenes.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-1">
    <span className="text-2xl">📋</span>
    <span>No hay órdenes pendientes de envío concentrado</span>
  </div>
)
```

**Cambio 4: Descripción**
```tsx
<p className="text-sm text-muted-foreground mt-0.5">
  Selecciona las órdenes pendientes de envío concentrado, genera el concentrado PDF y envía al director
</p>
```

### 4. Backend — Refactorizar EnvioConcentradoAsync

**Archivo:** `lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/FirmasService.cs`

**Eliminar:**
```csharp
private const int ACCION_AUTORIZAR_PASO4 = 8;  // ← eliminar
```

**Nueva implementación de `EnvioConcentradoAsync`:**
```csharp
public async Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoAsync(
    EnvioConcentradoRequest request, int idUsuario)
{
    try
    {
        var resultados = new List<EnvioConcentradoItemResult>();

        foreach (var idOrden in request.IdsOrdenes)
        {
            var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
            if (orden is null)
            {
                resultados.Add(new EnvioConcentradoItemResult
                {
                    IdOrden = idOrden,
                    Folio = $"OC-{idOrden}",
                    Exitoso = false,
                    Error = "Orden no encontrada."
                });
                continue;
            }

            if (!orden.IdPasoActual.HasValue)
            {
                resultados.Add(new EnvioConcentradoItemResult
                {
                    IdOrden = idOrden,
                    Folio = orden.Folio,
                    Exitoso = false,
                    Error = "La orden no tiene paso actual."
                });
                continue;
            }

            // Obtener acciones del paso actual y buscar la que tenga envia_concentrado
            var accionesPaso = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
            var accionEnviar = accionesPaso.FirstOrDefault(a => a.EnviaConcentrado && a.Activo);

            if (accionEnviar is null)
            {
                resultados.Add(new EnvioConcentradoItemResult
                {
                    IdOrden = idOrden,
                    Folio = orden.Folio,
                    Exitoso = false,
                    Error = "La orden no tiene una acción de envío concentrado disponible en su paso actual."
                });
                continue;
            }

            var firmarReq = new FirmarRequest
            {
                IdAccion = accionEnviar.IdAccion,
                Comentario = request.Comentario ?? "Enviado en lote desde Concentrado de Órdenes"
            };

            var resultado = await FirmarAsync(idOrden, firmarReq, idUsuario);

            if (resultado.IsError)
            {
                resultados.Add(new EnvioConcentradoItemResult
                {
                    IdOrden = idOrden,
                    Folio = orden.Folio,
                    Exitoso = false,
                    Error = resultado.FirstError.Description
                });
            }
            else
            {
                resultados.Add(new EnvioConcentradoItemResult
                {
                    IdOrden = idOrden,
                    Folio = resultado.Value.Folio,
                    Exitoso = true,
                    NuevoEstado = resultado.Value.NuevoEstado
                });
            }
        }

        var exitosas = resultados.Count(r => r.Exitoso);
        EnrichWideEvent("EnvioConcentrado", additionalContext: new Dictionary<string, object>
        {
            ["total"] = request.IdsOrdenes.Count,
            ["exitosas"] = exitosas,
            ["fallidas"] = resultados.Count - exitosas
        });

        return new EnvioConcentradoResponse
        {
            Total = request.IdsOrdenes.Count,
            Exitosas = exitosas,
            Fallidas = resultados.Count - exitosas,
            Resultados = resultados
        };
    }
    catch (Exception ex)
    {
        EnrichWideEvent("EnvioConcentrado", exception: ex);
        return CommonErrors.InternalServerError("Error inesperado al procesar el envío concentrado.");
    }
}
```

### 5. Backend — Verificar que GetAccionesDisponiblesAsync incluya EnviaConcentrado

**Archivo:** `lefarma.backend/src/Lefarma.API/Features/Config/Workflows/WorkflowRepository.cs`

**Verificación:** El método `GetAccionesDisponiblesAsync` del repositorio debe incluir la relación `TipoAccion` para que se pueda evaluar `a.EnviaConcentrado` correctamente. Revisar que la query tenga:
```csharp
.Include(a => a.TipoAccion)
```

Si no la tiene, agregarla.

### 6. Frontend — Obtener ID de estado dinámicamente (opcional/futuro)

**Archivo:** `lefarma.frontend/src/pages/ordenes/EnvioConcentrado.tsx`

Actualmente el `ESTADO_ENVIO_CONCENTRADO` es una constante hardcodeada. En el futuro se puede obtener de:
- Un endpoint de configuración
- O del workflow precargado (`workflowsMap` si se reutiliza la caché de `AutorizacionesOC`)

Por ahora, el ID del estado se configura manualmente en la constante.

---

## Tareas en orden

| Orden | Tarea | Archivos | Esfuerzo |
|-------|-------|----------|----------|
| 1 | Ocultar acciones `enviaConcentrado` en AutorizacionesOC | `AutorizacionesOC.tsx` | 15 min |
| 2 | Verificar `enviaConcentrado` en `AccionDisponibleResponse` | `FirmasDTOs.cs`, `FirmasService.cs` | 10 min |
| 3 | Refactorizar `EnvioConcentrado.tsx` para filtrar por estado | `EnvioConcentrado.tsx` | 20 min |
| 4 | Refactorizar `EnvioConcentradoAsync` (eliminar ID fijo) | `FirmasService.cs` | 25 min |
| 5 | Verificar `GetAccionesDisponiblesAsync` incluye relaciones | `WorkflowRepository.cs` | 5 min |
| 6 | Build backend + frontend | — | 10 min |
| 7 | Probar flujo completo | — | 15 min |

**Tiempo estimado total:** ~1.5 horas

---

## Validación

1. Orden llega al paso que tiene acción AUTORIZAR con `envia_concentrado = true`
2. En `AutorizacionesOC.tsx`, el usuario NO ve la acción AUTORIZAR (está oculta)
3. En `EnvioConcentrado.tsx`, la orden aparece (filtrada por `idEstado`)
4. Usuario selecciona la orden y presiona "Enviar"
5. Backend ejecuta `FirmarAsync` con la acción que tiene `envia_concentrado` del paso actual
6. La orden avanza al paso destino (Director)
7. La orden ya no aparece en `EnvioConcentrado.tsx`

---

## Notas

- **No se agrega columna nueva** en la base de datos. Se usa el flujo de estados/workflow existente.
- El ID del estado (`ESTADO_ENVIO_CONCENTRADO`) es una constante en el frontend. Se debe configurar con el ID real del estado en la base de datos (ej. `EN_REVISION_GAF`).
- La acción con `envia_concentrado = true` sigue existiendo en el workflow; solo se oculta en `AutorizacionesOC.tsx` y se ejecuta exclusivamente desde `EnvioConcentrado.tsx`.
- Si en el futuro se quieren mostrar las acciones ocultas para debugging, se puede agregar un flag de desarrollo.
