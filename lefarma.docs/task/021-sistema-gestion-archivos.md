---
id: "021"
title: "Sistema de Gestión de Archivos"
status: "completed"
created: "2026-03-26
updated: "2026-03-26
assignee: null
---

## Description

Sistema genérico y reutilizable para gestión de archivos (upload, preview, download y versionado) que permite subir documentos asociados a cualquier entidad del sistema (Cotizaciones, Productos, Clientes, etc.).

## Requirements

- [x] Upload de archivos with configurable types, size limits, and quantity limits
- [x] Replace files with versioning (old file marked as inactive)
- [x] List files filtered by entity type and ID
- [x] Preview files in browser (PDF, images, Office docs converted to PDF)
- [x] Download original files
- [x] Soft delete files
- [x] Flexible metadata storage in JSON format

## Technical Implementation

### Backend

| Component | Location |
|-----------|----------|
| Entity | `Domain/Entities/Archivos/Archivo.cs` |
| Repository | `Infrastructure/Data/ operation | `Infrastructure/Data/Repositories/ArchivoRepository.cs` |
| Service | `Features/Archivos/Services/ArchivoService.cs` |
| Controller | `Features/Archivos/Controllers/ArchivosController.cs` |
| DTOs | `Features/Archivos/DTOs/` |
| Settings | `Features/Archivos/Settings/ArchivosSettings.cs` |
| Converter | `Features/Archivos/Conversores/OfficeToPdfConverter.cs` |
| Errors | `Shared/Errors/ArchivoErrors.cs` |

### Frontend

| Component | Location |
| ----------- | ---------- |
| Types | `src/types/archivo.types.ts` |
| Service | `src/services/archivoService.ts` |
| FileUploader | `src/components/archivos/FileUploader.tsx` |
| FileViewer | `src/components/archivos/FileViewer.tsx` |
| Index | `src/components/archivos/index.ts` |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/archivos/upload` | Upload new file |
| POST | `/api/archivos/{id}/reemplazar` | Replace existing file |
| GET | `/api/archivos/{id}` | Get file metadata |
| GET | `/api/archivos` | List files with filters |
| GET | `/api/archivos/{id}/download` | Download original file |
| GET | `/api/archivos/{id}/preview` | Preview file (PDF for Office docs) |
| DELETE | `/api/archivos/{id}` | Soft delete file |

## Acceptance Criteria
- [x] Can upload PDF, Excel, Word, PowerPoint, and image files
- [x] Files are stored in configurable base path with custom folder structure
- [x] Can list files filtered by entity type and ID
- [x] Can preview PDFs and images directly in browser
- [x] Can preview Office documents (converted to PDF)
- [x] Can download original files
- [x] Can replace files (old version marked as inactive)
- [x] Can delete files (soft delete with file renaming)
- [x] Metadata is stored in JSON format
- [x] Works on Windows and Linux (LibreOffice path configurable)

## Configuration

### appsettings.json
```json
"ArchivosSettings": {
  "BasePath": "wwwroot/media/archivos",
  "LibreOfficePath": "/usr/bin/soffice",
  "TamanoMaximoMB": 10,
  "ExtensionesPermitidas": [".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"]
}
```

### appsettings.Development.json (Windows)
```json
"ArchivosSettings": {
  "LibreOfficePath": "C:\\Program Files\\LibreOffice\\program\\soffice.exe"
}
```

## Usage Examples

```tsx
import { FileUploader, FileUploader } from '@/components/archivos';

// Upload files
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
  onUploadComplete={(archivos) => console.log('Subidos:', archivos)}
/>

// View file
<FileViewer
  open={showViewer}
  onClose={() => setShowViewer(false)}
  archivoId={456}
/>
```

## Dependencies

### Backend
- .NET 10
- EF Core 10
- ErrorOr

### Frontend
- React 19
- pdfjs-dist (for PDF preview)
- lucide-react (icons)
- sonner (toast notifications)
