# Excel Preview con SheetJS - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar previsualización de archivos Excel (.xlsx) en el FileViewer usando SheetJS, mostrando los datos en una tabla HTML.

**Architecture:** 
- Usar SheetJS (xlsx) para parsear el archivo Excel
- Fetch con autenticación via API.get() → blob → ArrayBuffer
- Convertir primera hoja a JSON y renderizar en tabla HTML
- Si hay error o archivo muy grande, mostrar opción de descarga

**Tech Stack:** 
- `xlsx` (SheetJS) - librería para leer Excel
- React + Tailwind para UI
- API existente con auth

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `lefarma.frontend/package.json` | Modificar | Agregar dependencia `xlsx` |
| `lefarma.frontend/src/components/archivos/FileViewer.tsx` | Modificar | Agregar lógica de preview Excel |
| `lefarma.frontend/src/components/archivos/ExcelTable.tsx` | Crear | Componente tabla para mostrar datos Excel |

---

## Task 1: Instalar SheetJS

**Files:**
- Modify: `lefarma.frontend/package.json`

- [ ] **Step 1: Instalar xlsx**

```bash
cd lefarma.frontend && npm install xlsx
```

Expected: Package instalado sin errores

- [ ] **Step 2: Verificar instalación**

```bash
cd lefarma.frontend && npm list xlsx
```

Expected: `xlsx@0.18.5` (o versión similar)

---

## Task 2: Crear componente ExcelTable

**Files:**
- Create: `lefarma.frontend/src/components/archivos/ExcelTable.tsx`

- [ ] **Step 1: Crear ExcelTable.tsx**

```tsx
// lefarma.frontend/src/components/archivos/ExcelTable.tsx
interface ExcelTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
}

export function ExcelTable({ data, maxRows = 100 }: ExcelTableProps) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-center py-4">El archivo está vacío</p>;
  }

  const headers = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <div className="overflow-auto max-h-[400px] border rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-3 py-2 text-left font-medium text-gray-700 border-b"
              >
                {header || `(Columna ${idx + 1})`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {displayData.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
              {headers.map((header, colIdx) => (
                <td key={colIdx} className="px-3 py-2 text-gray-600">
                  {String(row[header] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="p-2 bg-gray-50 text-center text-sm text-gray-500 border-t">
          Mostrando {maxRows} de {data.length} filas
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Exportar desde index.ts**

Agregar en `lefarma.frontend/src/components/archivos/index.ts`:

```ts
export { ExcelTable } from './ExcelTable';
```

---

## Task 3: Modificar FileViewer para preview Excel

**Files:**
- Modify: `lefarma.frontend/src/components/archivos/FileViewer.tsx`

- [ ] **Step 1: Agregar imports**

Al inicio del archivo, agregar:

```tsx
import * as XLSX from 'xlsx';
import { ExcelTable } from './ExcelTable';
```

- [ ] **Step 2: Agregar estado para datos Excel**

Después de `const [error, setError] = useState<string | null>(null);`, agregar:

```tsx
const [excelData, setExcelData] = useState<Record<string, unknown>[] | null>(null);
const [previewLoading, setPreviewLoading] = useState(false);
```

- [ ] **Step 3: Crear función para cargar Excel**

Después de `loadArchivo`, agregar:

```tsx
const loadExcelPreview = useCallback(async () => {
  if (!archivo) return;
  
  const excelExtensions = ['.xlsx', '.xls'];
  if (!excelExtensions.includes(archivo.extension.toLowerCase())) return;

  setPreviewLoading(true);
  setExcelData(null);

  try {
    const response = await API.get(`/archivos/${archivo.id}/preview`, {
      responseType: 'arraybuffer'
    });

    const workbook = XLSX.read(response.data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    setExcelData(data);
  } catch (err) {
    console.error('Error loading Excel preview:', err);
    // Si falla, simplemente no mostramos preview, solo descarga
  } finally {
    setPreviewLoading(false);
  }
}, [archivo]);
```

- [ ] **Step 4: Agregar import de API**

Agregar al inicio:

```tsx
import { API } from '@/services/api';
```

- [ ] **Step 5: Agregar useEffect para cargar preview**

Después del useEffect de loadArchivo, agregar:

```tsx
useEffect(() => {
  if (archivo && !loading) {
    loadExcelPreview();
  }
}, [archivo, loading, loadExcelPreview]);
```

- [ ] **Step 6: Agregar helper para detectar Excel**

Después de `getExtensionColor`, agregar:

```tsx
const isExcelFile = (ext: string): boolean => {
  return ['.xlsx', '.xls'].includes(ext.toLowerCase());
};
```

- [ ] **Step 7: Modificar el contenido del modal**

Reemplazar la sección `{!loading && !error && archivo && (...)}` con:

```tsx
{!loading && !error && archivo && (
  <>
    {/* File icon and name */}
    <div className="flex items-center gap-4">
      <div className={`px-3 py-2 rounded-lg text-sm font-medium uppercase ${getExtensionColor(archivo.extension)}`}>
        {archivo.extension.replace('.', '')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{archivo.nombreOriginal}</p>
        <p className="text-sm text-gray-500">{archivo.tipoMime}</p>
      </div>
    </div>

    {/* File details */}
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3 text-gray-600">
        <HardDrive className="w-4 h-4" />
        <span>Tamaño: {formatSize(archivo.tamanoBytes)}</span>
      </div>
      <div className="flex items-center gap-3 text-gray-600">
        <Calendar className="w-4 h-4" />
        <span>Subido: {formatDate(archivo.fechaCreacion)}</span>
      </div>
    </div>

    {/* Excel Preview */}
    {isExcelFile(archivo.extension) && (
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Vista previa</h3>
        {previewLoading && (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        {excelData && <ExcelTable data={excelData} />}
      </div>
    )}

    {/* Download button */}
    <button
      onClick={handleDownload}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
    >
      <Download className="w-5 h-5" />
      {textoDescargar}
    </button>
  </>
)}
```

- [ ] **Step 8: Aumentar max-width del modal**

Cambiar `max-w-md` por `max-w-2xl` en el div del modal:

```tsx
<div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
```

---

## Task 4: Actualizar exports

**Files:**
- Modify: `lefarma.frontend/src/components/archivos/index.ts`

- [ ] **Step 1: Verificar/actualizar exports**

El archivo debe quedar:

```tsx
export { FileUploader } from './FileUploader';
export { FileViewer } from './FileViewer';
export { ExcelTable } from './ExcelTable';
```

---

## Task 5: Probar la implementación

- [ ] **Step 1: Compilar frontend**

```bash
cd lefarma.frontend && npm run build
```

Expected: Sin errores

- [ ] **Step 2: Verificar tipos TypeScript**

```bash
cd lefarma.frontend && npx tsc --noEmit
```

Expected: Sin errores

- [ ] **Step 3: Probar manualmente**

1. Ir a http://localhost:5173/demo-components
2. Subir un archivo Excel (.xlsx)
3. Click en "Visualizar" con el ID
4. Verificar que:
   - Se muestra la tabla con los datos
   - El botón descargar sigue funcionando
   - El modal se puede cerrar con X, Escape, o click fuera

---

## Task 6: Commit

- [ ] **Step 1: Commit de cambios**

```bash
git add lefarma.frontend/package.json lefarma.frontend/package-lock.json lefarma.frontend/src/components/archivos/
git commit -m "feat(archivos): agregar preview de Excel con SheetJS

- Instalado xlsx (SheetJS) para parsear Excel
- Creado componente ExcelTable para mostrar datos
- FileViewer ahora muestra preview de .xlsx/.xls
- Tabla con scroll, máximo 100 filas visibles"
```

---

## Notas

- **Limitaciones**: Solo muestra la primera hoja del Excel
- **Performance**: Limitado a 100 filas para evitar problemas de memoria
- **Formatos**: Solo .xlsx y .xls, no soporta .csv (se podría agregar fácilmente)
- **Autenticación**: El fetch usa API.get() que incluye el token Bearer
