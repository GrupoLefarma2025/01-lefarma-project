# Tab Archivos: Botón Eliminar y Nueva Convención de Renombrado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar funcionalidad de "desactivar" (soft-delete) archivo desde el tab de archivos en órdenes de compra, filtrar listado para solo mostrar activos, y cambiar la convención de renombrado de archivos adjuntos a `FOLIO-DDMMYYYY-CONTADOR`.

**Architecture:** El backend ya implementa soft-delete (`DeleteAsync` marca `Activo = false` y renombra el físico). Solo hace falta exponer el botón en el frontend y hacer explícito el filtro `soloActivos`. En el backend, se modifica el controlador `ArchivosController` para aplicar el nuevo patrón de nombre al subir adjuntos de orden de compra.

**Tech Stack:** React 19 + Vite + TypeScript, shadcn/ui, Lucide React, .NET 10 Web API, EF Core, SQL Server

---

## File Map

- **Modify:** `lefarma.frontend/src/pages/ordenes/AutorizacionesOC.tsx` — Agrega botón de eliminar, handler de desactivación, y filtro explícito `soloActivos`.
- **Modify:** `lefarma.backend/src/Lefarma.API/Features/Archivos/Controllers/ArchivosController.cs` — Cambia lógica de renombrado de adjuntos de workflow al nuevo formato.

---

## Task 1: Frontend — Agregar botón Eliminar y filtrar activos

**Files:**
- Modify: `lefarma.frontend/src/pages/ordenes/AutorizacionesOC.tsx`

### Step 1: Agregar icono `Trash2` al import de Lucide

Busca el bloque de imports de `lucide-react` (aprox línea 27) y agrega `Trash2`:

```tsx
import {
  Loader2,
  FileText,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  Paperclip,
  Eye,
  Download,
  Clock,
  AlertCircle,
  XCircle,
  AlertTriangle,
  UserRound,
  Printer,
  MoveRight,
  Send,
  RotateCcw,
  Receipt,
  Banknote,
  Upload,
  Pencil,
  Trash2,  // <-- AGREGAR
} from 'lucide-react';
```

### Step 2: Hacer explícito el filtro `soloActivos` en `fetchArchivosOrden`

Localiza `fetchArchivosOrden` (aprox línea 502) y modifica la llamada a `archivoService.getAll`:

```tsx
  const fetchArchivosOrden = async (idOrden: number) => {
    try {
      setLoadingArchivos(true);
      const archivos = await archivoService.getAll({
        entidadTipo: 'OrdenCompra',
        entidadId: idOrden,
        soloActivos: true,  // <-- AGREGAR ESTA LÍNEA
      });
      setArchivosOrden(archivos);
    } catch {
      setArchivosOrden([]);
    } finally {
      setLoadingArchivos(false);
    }
  };
```

### Step 3: Implementar handler `handleEliminarArchivo`

Agrega esta función justo debajo de `fetchArchivosOrden` (aprox línea 514), dentro del componente `AutorizacionesOC`:

```tsx
  const handleEliminarArchivo = async (idArchivo: number) => {
    if (!window.confirm('¿Deseas desactivar este archivo?')) return;
    try {
      await archivoService.delete(idArchivo);
      toast.success('Archivo desactivado correctamente');
      if (selectedOrden) {
        fetchArchivosOrden(selectedOrden.idOrden);
      }
    } catch {
      toast.error('Error al desactivar el archivo');
    }
  };
```

### Step 4: Agregar botón Eliminar en la lista de archivos

Localiza la sección donde se renderizan los botones "Ver" y "Descargar" (aprox línea 2304). Agrega el botón de eliminar junto al de descarga:

Reemplaza este bloque:
```tsx
                                      <div className="flex shrink-0 items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Ver documento"
                                          onClick={() => setViewerArchivoId(archivo.id)}>
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                        <a href={archivoService.getDownloadUrl(archivo.id)} target="_blank" rel="noopener noreferrer" title="Descargar">
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                            <Download className="h-3.5 w-3.5" />
                                          </Button>
                                        </a>
                                      </div>
```

Por este:
```tsx
                                      <div className="flex shrink-0 items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Ver documento"
                                          onClick={() => setViewerArchivoId(archivo.id)}>
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                        <a href={archivoService.getDownloadUrl(archivo.id)} target="_blank" rel="noopener noreferrer" title="Descargar">
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                            <Download className="h-3.5 w-3.5" />
                                          </Button>
                                        </a>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                          title="Desactivar archivo"
                                          onClick={() => handleEliminarArchivo(archivo.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
```

### Step 5: Verificar lint

Run:
```bash
cd lefarma.frontend && npm run lint
```
Expected: No errors, no warnings relevantes.

---

## Task 2: Backend — Cambiar convención de renombrado de archivos adjuntos

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Archivos/Controllers/ArchivosController.cs`

### Step 1: Reemplazar lógica de renombrado para adjuntos de orden de compra

Localiza el bloque de renombrado de archivos adjuntos (líneas aprox 59-89). Reemplázalo completamente:

**Antes:**
```csharp
        // Renombrar archivos adjuntos de workflow con formato: {folio}-Paso{id}-{nombrePaso}-adjunto-{N}.ext
        var fileName = file.FileName;
        if (request.EntidadTipo == "OrdenCompra" && request.Carpeta == "ordenes-compra")
        {
            var folio = await _db.OrdenesCompra
                .Where(o => o.IdOrden == request.EntidadId)
                .Select(o => o.Folio)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(folio))
            {
                string pasoInfo = "";
                if (!string.IsNullOrWhiteSpace(request.Metadata))
                {
                    try
                    {
                        using var metaDoc = JsonDocument.Parse(request.Metadata);
                        var raiz = metaDoc.RootElement;
                        var idPaso = raiz.TryGetProperty("paso", out var p) ? p.GetString() ?? "" : "";
                        var nombrePaso = raiz.TryGetProperty("nombrePaso", out var np) ? np.GetString() ?? "" : "";
                        if (!string.IsNullOrWhiteSpace(idPaso) && !string.IsNullOrWhiteSpace(nombrePaso))
                            pasoInfo = $"-Paso{idPaso}-{nombrePaso.Replace(' ', '_')}";
                    }
                    catch { /* metadata invalido */ }
                }

                var count = await _service.GetArchivosCountAsync(request.EntidadTipo, request.EntidadId, request.Carpeta);
                var ext = Path.GetExtension(file.FileName);
                fileName = $"{folio}{pasoInfo}-adjunto-{count + 1}{ext}";
            }
        }
```

**Después:**
```csharp
        // Renombrar archivos adjuntos de orden de compra con formato: {folio}-{ddMMyyyy}-{N}.ext
        var fileName = file.FileName;
        if (request.EntidadTipo == "OrdenCompra" && request.Carpeta == "ordenes-compra")
        {
            var folio = await _db.OrdenesCompra
                .Where(o => o.IdOrden == request.EntidadId)
                .Select(o => o.Folio)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(folio))
            {
                var fecha = DateTime.Now.ToString("ddMMyyyy");
                var count = await _service.GetArchivosCountAsync(request.EntidadTipo, request.EntidadId, request.Carpeta);
                var ext = Path.GetExtension(file.FileName);
                fileName = $"{folio}-{fecha}-{count + 1}{ext}";
            }
        }
```

> **Nota:** Se asume que `DDMMAAA` es `ddMMyyyy` (día, mes, año de 4 dígitos). Si se requiere otro formato de fecha, ajustar el string `"ddMMyyyy"`.

### Step 2: Verificar build

Run:
```bash
cd lefarma.backend && dotnet build
```
Expected: Build succeeded.

---

## Spec Coverage Check

| Requirement | Task / Step |
|-------------|-------------|
| Botón "Eliminar" en cada archivo del tab | Task 1, Step 4 |
| Desactivar archivo (soft-delete) al presionar Eliminar | Task 1, Step 3 (llama `archivoService.delete` que ya hace soft-delete en backend) |
| Tab solo trae archivos activos | Task 1, Step 2 (filtro explícito `soloActivos: true`) |
| Nueva convención de renombrado `FOLIO-DDMMYYYY-CONTADOR` | Task 2, Step 1 |

---

## Placeholder Scan

- No TBDs, TODOs, or "implement later" found.
- No vague "add error handling" steps — el código incluye try/catch con toast.
- No "write tests for the above" without code — cada paso tiene código completo.

---

## Execution Handoff

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** - Execute tasks in this session with checkpoints.

Which approach?
