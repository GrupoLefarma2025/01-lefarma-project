## Why

Hoy el alta de proveedores se hace uno por uno desde el modal "Nuevo Proveedor". Cuando el área de CxP recibe lotes (migración de catálogo, alta de varias sucursales, etc.) tienen que capturar cada registro a mano, lo cual es lento y propenso a errores. Se necesita una vía de carga masiva por CSV que permita subir muchos proveedores en una sola operación, con una plantilla descargable que indique qué columnas son requeridas y cuáles opcionales para que cualquier usuario pueda preparar el archivo sin documentación externa.

## What Changes

- **Frontend** (`ProveedoresList.tsx`): agregar dos botones en la barra superior, al lado de "Nuevo Proveedor":
  - **"Descargar Plantilla"**: genera el CSV de ejemplo *en vivo* (en el navegador) con encabezados etiquetados `(requerido)` / `(opcional)` y filas de ejemplo (incluyendo un proveedor con dos cuentas para documentar el patrón de agrupación).
  - **"Carga Masiva"**: abre un modal que permite seleccionar un archivo CSV, previsualiza filas detectadas, valida y dispara la importación.
- Nuevo modal de carga masiva con: drop-zone/file input, tabla de previsualización (primeras N filas), botón "Validar", botón "Importar", y reporte de resultado (proveedores importados OK / fallidos con motivo por fila, conteo separado de cuentas creadas).
- **Backend** (`ProveedoresController`): nuevo endpoint `POST /api/catalogos/Proveedores/bulk-upload` que recibe `multipart/form-data` con el CSV, parsea, agrupa filas con misma `RazonSocial`/`RFC` en un mismo proveedor (cada fila adicional = una cuenta bancaria más), valida reusando `CreateProveedorRequestValidator`, y persiste en una transacción los que pasan validación.
- **Importación de cuentas bancarias**: cada fila puede incluir una cuenta bancaria opcional (`FormaPagoId`, `BancoId`, `NumeroCuenta`, `CLABE`, `NumeroTarjeta`, `Beneficiario`, `CorreoNotificacion`). Múltiples cuentas para un mismo proveedor se expresan como múltiples filas consecutivas con la misma `RazonSocial`/`RFC` y sólo las columnas de cuenta diferentes (las columnas de datos fiscales y de contacto se toman de la primera fila del grupo).
- **Service**: nuevo `BulkUploadAsync(IFormFile file)` en `IProveedorService` / `ProveedorService` que devuelve un `BulkUploadResultResponse` con conteos (proveedores creados, cuentas creadas, fallidos) y errores por fila.
- Validación de duplicados (razón social y RFC) tanto contra la BD como dentro del mismo CSV (excepto cuando son filas del mismo grupo de cuentas, que es lo esperado).
- Resolución de `FormaPagoId` y `BancoId` por id numérico contra los catálogos correspondientes; id inválido = error de fila.
- Estatus por default `Nuevo` (1) para todas las filas importadas — siguen el flujo normal de autorización por CxP.
- Permiso nuevo: `proveedores.cargaMasiva` (gate del botón y del endpoint vía `PermissionElement` / atributo).

## Capabilities

### New Capabilities
- `proveedores-bulk-upload`: alta masiva de proveedores vía CSV (plantilla descargable client-side, parseo y validación server-side, reporte de errores por fila).

### Modified Capabilities
<!-- No hay specs previas en openspec/specs/, por lo que sólo se introduce capability nueva. -->

## Impact

- **Frontend**:
  - `lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx` (UI: 2 botones nuevos + modal).
  - Nuevo helper en `lefarma.frontend/src/utils/` para generar el CSV en cliente (Blob + download trigger).
  - Posible nuevo componente `BulkUploadModal.tsx` en `Proveedores/`.
  - Servicio `proveedorApi` en `services/api.ts` con dos métodos nuevos (`bulkUpload`, opcionalmente `downloadTemplate`).
- **Backend**:
  - `Features/Catalogos/Proveedores/ProveedoresController.cs` (2 endpoints nuevos).
  - `Features/Catalogos/Proveedores/ProveedorService.cs` + `IProveedorService` (método `BulkUploadAsync`).
  - `Features/Catalogos/Proveedores/DTOs/ProveedorDTOs.cs` (DTOs: `BulkUploadResultResponse`, `BulkUploadRowError`).
  - Parser CSV: usar `CsvHelper` si ya está en el proyecto, o agregar como dependencia nueva.
  - Validadores existentes (`CreateProveedorRequestValidator`) se reutilizan.
- **Permisos**: nuevo permiso `proveedores.cargaMasiva` registrado en el catálogo de permisos.
- **Sin cambios** en flujo de aprobación / staging — los proveedores importados entran como `Nuevo` y siguen el ciclo existente.
- **No breaking changes**: feature aditiva.
