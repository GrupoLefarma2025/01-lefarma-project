# Spec: Sistema de Gestión de Archivos

**Fecha:** 2026-03-25  
**Estado:** Draft  
**Autor:** Diseño colaborativo

---

## 1. Resumen

Sistema genérico y reutilizable para gestión de archivos que permite subir, almacenar, previsualizar y descargar documentos (PDF, Word, Excel, PowerPoint, imágenes) desde múltiples módulos del sistema (Cotizaciones, Productos, Clientes, etc.).

---

## 2. Requisitos

### 2.1 Funcionales

- Subir archivos asociados a cualquier entidad (Cotización, Producto, etc.)
- Configurar tipos permitidos, tamaño máximo y cantidad máxima por contexto
- Reemplazar archivos con versionado (archivo anterior se inactiva)
- Listar archivos con filtros por entidad
- Previsualizar archivos en el navegador (PDF, imágenes, Office convertido a PDF)
- Descargar archivos originales
- Soft delete de archivos
- Metadata flexible en JSON para cada implementación

### 2.2 No Funcionales

- Compatible con Windows y Linux (LibreOffice para conversión)
- Almacenamiento configurable en appsettings
- Límites de tamaño configurables
- Frontend responsive (canvas-based, sin iframes)

---

## 3. Arquitectura

### 3.1 Backend - Base de Datos

**Tabla `Archivos`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Id` | int (PK) | Identificador único |
| `EntidadTipo` | nvarchar(100) | "Cotizacion", "Producto", etc. |
| `EntidadId` | int | ID de la entidad relacionada |
| `Carpeta` | nvarchar(500) | Path relativo dentro del base path |
| `NombreOriginal` | nvarchar(255) | Nombre que subió el usuario |
| `NombreFisico` | nvarchar(255) | GUID único en disco |
| `Extension` | nvarchar(20) | .pdf, .xlsx, .docx, etc. |
| `TipoMime` | nvarchar(100) | application/pdf, image/jpeg |
| `TamanoBytes` | bigint | Tamaño del archivo |
| `Metadata` | nvarchar(max) | JSON flexible por módulo |
| `FechaCreacion` | datetime | Fecha de creación |
| `FechaEdicion` | datetime? | Fecha de última edición (nullable) |
| `UsuarioId` | int? | ID del usuario que subió (nullable) |
| `Activo` | bit | Soft delete |

**Índices:**
- `IX_Archivos_Entidad` (EntidadTipo, EntidadId)
- `IX_Archivos_Carpeta` (Carpeta)

### 3.2 Backend - Estructura de Archivos

```
Domain/Entities/Archivos/
└── Archivo.cs

Domain/Interfaces/
└── IArchivoRepository.cs

Infrastructure/Data/Configurations/Archivos/
└── ArchivoConfiguration.cs

Infrastructure/Data/Repositories/
└── ArchivoRepository.cs

Features/Archivos/
├── Controllers/
│   └── ArchivosController.cs
├── Services/
│   ├── IArchivoService.cs
│   └── ArchivoService.cs
├── DTOs/
│   ├── ArchivoResponse.cs
│   ├── ArchivoListItemResponse.cs
│   ├── SubirArchivoRequest.cs
│   └── ListarArchivosQuery.cs
└── Conversores/
    └── OfficeToPdfConverter.cs

Shared/Errors/
└── ArchivoErrors.cs
```

### 3.3 Backend - Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/archivos/upload` | Subir archivo nuevo |
| `POST` | `/api/archivos/{id}/reemplazar` | Reemplazar archivo existente (versionado) |
| `GET` | `/api/archivos/{id}` | Obtener metadata de un archivo |
| `GET` | `/api/archivos` | Listar archivos (filtros: entidadTipo, entidadId, soloActivos) |
| `GET` | `/api/archivos/{id}/download` | Descargar archivo original |
| `GET` | `/api/archivos/{id}/preview` | Previsualización (PDF convertido si es Office, 415 si no soportado) |
| `DELETE` | `/api/archivos/{id}` | Soft delete (Activo = false, renombra con `_inactivo`) |

### 3.4 Backend - Configuración

**appsettings.json:**
```json
{
  "ArchivosSettings": {
    "BasePath": "wwwroot/media/archivos",
    "LibreOfficePath": "/usr/bin/soffice",
    "TamanoMaximoMB": 10,
    "ExtensionesPermitidas": [".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"]
  }
}
```

**appsettings.Development.json (Windows):**
```json
{
  "ArchivosSettings": {
    "LibreOfficePath": "C:\\Program Files\\LibreOffice\\program\\soffice.exe"
  }
}
```

### 3.5 Backend - Lógica de Reemplazo

1. Archivo anterior: `Activo = false`, `NombreFisico` cambia de `abc123.pdf` → `abc123_inactivo.pdf`
2. Archivo nuevo: Se crea con `Activo = true`, nuevo GUID
3. Ambos se mantienen en BD y disco (el inactivo para historial/recuperación)

### 3.6 Backend - Lógica de Preview

- **PDF / Imágenes** → Devuelve el archivo directamente
- **Office (docx, xlsx, pptx)** → Convierte a PDF con LibreOffice headless y devuelve el PDF
- **No soportado** → Devuelve `415 Unsupported Media Type`

### 3.7 Frontend - Tipos

**Archivo:** `src/types/archivo.types.ts`

```typescript
export interface Archivo {
  id: number;
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  nombreOriginal: string;
  nombreFisico: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  metadata: unknown;
  fechaCreacion: string;
  fechaEdicion: string | null;
  usuarioId: number | null;
  activo: boolean;
}

export interface ArchivoListItem {
  id: number;
  nombreOriginal: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  fechaCreacion: string;
  activo: boolean;
}

export interface ListarArchivosParams {
  entidadTipo?: string;
  entidadId?: number;
  soloActivos?: boolean;
}
```

### 3.8 Frontend - Servicio API

**Archivo:** `src/services/archivoService.ts`

| Método | Descripción |
|--------|-------------|
| `upload(file, params)` | Subir archivo nuevo |
| `reemplazar(id, file, metadata?)` | Reemplazar archivo existente |
| `getById(id)` | Obtener metadata |
| `getAll(params)` | Listar con filtros |
| `download(id)` | Retorna URL de descarga |
| `preview(id)` | Retorna URL de previsualización |
| `delete(id)` | Soft delete |

### 3.9 Frontend - Componentes

#### FileUploader

**Archivo:** `src/components/archivos/FileUploader.tsx`

**Props:**
```typescript
interface FileUploaderProps {
  // Parámetros de negocio
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  metadata?: unknown;
  
  // Configuración de archivos
  tiposPermitidos?: string[];        // default: ['.pdf', '.xlsx', '.docx', '.pptx', '.jpg', '.png']
  tamanoMaximoMB?: number;           // default: 10
  cantidadMaxima?: number;           // default: 1
  multiple?: boolean;                // default: false
  
  // Textos personalizables
  titulo?: string;                   // default: 'Subir archivo'
  descripcion?: string;              // default: 'Arrastrá o hacé clic para seleccionar'
  textoErrorTipo?: string;
  textoErrorTamano?: string;
  textoErrorCantidad?: string;
  
  // Estado
  open: boolean;
  
  // Callbacks
  onUploadComplete: (archivos: Archivo[]) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}
```

**Uso:**
```tsx
<FileUploader
  open={showUploader}
  onClose={() => setShowUploader(false)}
  entidadTipo="Cotizacion"
  entidadId={123}
  carpeta="cotizaciones/123/documentos"
  tiposPermitidos={['.pdf', '.xlsx']}
  tamanoMaximoMB={5}
  cantidadMaxima={4}
  multiple
  titulo="Subir cotizaciones"
  onUploadComplete={(archivos) => {
    console.log('Subidos:', archivos);
    setShowUploader(false);
  }}
/>
```

#### FileViewer

**Archivo:** `src/components/archivos/FileViewer.tsx`

**Props:**
```typescript
interface FileViewerProps {
  archivoId: number;
  titulo?: string;
  textoNoSoportado?: string;    // default: 'Formato no soportado para previsualización'
  textoDescargar?: string;      // default: 'Descargar'
  open: boolean;
  onClose: () => void;
}
```

**Flujo:**
1. Frontend llama `GET /api/archivos/{id}/preview`
2. **Soportado** (PDF, imagen, Office convertido) → Backend devuelve archivo → Frontend renderiza en `<canvas>`
3. **No soportado** → Backend devuelve `415` → Frontend dibuja mensaje + ícono + botón en `<canvas>`

**Uso:**
```tsx
<FileViewer
  open={showViewer}
  onClose={() => setShowViewer(false)}
  archivoId={456}
/>
```

---

## 4. Requisitos de Instalación

### 4.1 Backend (Servidor)

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libreoffice --no-install-suggests
# Path: /usr/bin/soffice
```

**Windows:**
```powershell
# Descargar e instalar desde: https://www.libreoffice.org/download/download/
# Path por defecto: C:\Program Files\LibreOffice\program\soffice.exe
```

### 4.2 Frontend

```bash
cd lefarma.frontend
npm install pdfjs-dist
```

---

## 5. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| LibreOffice no instalado | Si falta, preview de Office devuelve 415 y se ofrece descarga directa |
| Archivos huérfanos en disco | Proceso de cleanup periódico (futuro) |
| Tamaño de archivos muy grande | Límite configurable, validación en frontend y backend |
| Conversión lenta | Considerar cola de procesamiento para archivos grandes (futuro) |

---

## 6. Criterios de Aceptación

- [ ] Puedo subir un archivo PDF asociado a una entidad
- [ ] Puedo subir múltiples archivos con límite configurable
- [ ] Puedo reemplazar un archivo y el anterior queda inactivo
- [ ] Puedo listar archivos filtrados por entidad
- [ ] Puedo previsualizar PDFs en canvas
- [ ] Puedo previsualizar imágenes en canvas
- [ ] Puedo previsualizar Office convertido a PDF en canvas
- [ ] Archivos no soportados muestran mensaje con opción de descargar
- [ ] Puedo descargar el archivo original
- [ ] Puedo eliminar archivos (soft delete)
- [ ] Funciona en Windows y Linux
