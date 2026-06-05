## 1. Backend - Setup y DTOs

- [x] 1.1 Verificar si `CsvHelper` está en `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj`; si no, agregar `<PackageReference Include="CsvHelper" Version="33.0.1" />`.
- [x] 1.2 Agregar DTOs nuevos en `Features/Catalogos/Proveedores/DTOs/ProveedorDTOs.cs`:
  - `BulkUploadCsvRow` con todas las columnas: datos del proveedor (`RazonSocial`, `RFC`, `CodigoPostal`, `RegimenFiscalId`, `UsoCfdi`, `PersonaContactoNombre`, `ContactoTelefono`, `ContactoEmail`, `Comentario`) **+ datos de cuenta bancaria** (`FormaPagoId`, `BancoId`, `NumeroCuenta`, `CLABE`, `NumeroTarjeta`, `Beneficiario`, `CorreoNotificacion`).
  - `BulkUploadRowError { int RowNumber; string? Field; string Message; }`.
  - `BulkUploadResultResponse { int TotalRows; int ProveedoresImported; int CuentasImported; int FailedRows; List<BulkUploadRowError> Errors; }`.
- [x] 1.3 Definir constante `BulkUploadColumns` con la lista ordenada de nombres esperados (sin sufijos `(requerido)`/`(opcional)`) y un set de columnas requeridas (`RazonSocial`).

## 2. Backend - Servicio `BulkUploadAsync`

- [x] 2.1 Agregar firma `Task<ErrorOr<BulkUploadResultResponse>> BulkUploadAsync(Stream csvStream, string fileName)` en `IProveedorService`.
- [x] 2.2 Implementar `BulkUploadAsync` en `ProveedorService.cs`:
  - Validar tamaño (rechazar > 5 MB) y extensión (`.csv`).
  - Parsear con `CsvHelper` con `HeaderValidated = null, MissingFieldFound = null` (manejo manual), detectando BOM.
  - Limpiar sufijos `" (requerido)"` / `" (opcional)"` de los headers antes de mapear.
  - Validar que la columna requerida `RazonSocial` esté presente; si falta, devolver `CommonErrors.Validation`.
  - Cargar todos los `RegimenesFiscales`, `FormasPago` y `Bancos` activos a tres `HashSet<int>` de ids válidos (una sola query cada uno).
  - **Algoritmo de agrupación por filas consecutivas:**
    - Iterar las filas en orden con índice (rowNumber = 2-indexed por el header).
    - Mantener un `groupKey = (RazonSocial, RFC)` del proveedor actual.
    - Si la fila tiene la misma `groupKey` que la anterior **Y** es la inmediatamente siguiente → es "cuenta adicional" del proveedor actual: ignorar columnas fiscales/contacto, intentar crear sólo la cuenta.
    - Si la fila tiene una `groupKey` distinta → cerrar el grupo anterior y empezar grupo nuevo: validar `CreateProveedorRequest` y persistir proveedor con su cuenta (si `FormaPagoId` no vacío).
    - Si la `groupKey` ya apareció antes pero NO consecutiva → reportar error duplicado con mensaje específico ("si quieres agregar más cuentas, las filas deben estar consecutivas").
  - Por fila válida con `FormaPagoId` presente:
    - Resolver `FormaPagoId` → `IdFormaPago` (error si inválida).
    - Resolver `BancoId` (si no vacía) → `IdBanco` (error si inválida); si vacía → `null`.
    - Construir `ProveedorFormaPagoCuenta` y asociar al proveedor padre (en memoria; persistencia en transacción única).
  - Por cada fila "líder de grupo": construir `CreateProveedorRequest`, invocar `CreateProveedorRequestValidator.ValidateAsync` y registrar errores en `BulkUploadRowError`.
  - Detectar duplicados intra-archivo no consecutivos por `RazonSocial` y `RFC` (HashSet en memoria con sets de "ya vistos" y "key actual").
  - Detectar duplicados contra BD: cargar `Proveedores.Select(p => new { p.RazonSocial, p.RFC })` una sola vez al inicio.
  - Insertar las entidades válidas dentro de `await using var tx = await _dbContext.Database.BeginTransactionAsync()`; commit al final.
  - Devolver `BulkUploadResultResponse` con `ProveedoresImported`, `CuentasImported`, `FailedRows`, y errores.
- [x] 2.3 Emitir `EnrichWideEvent(action: "BulkUpload", ...)` con totales (proveedores, cuentas, fallidos) y duración.
- [x] 2.4 Manejar excepciones `DbUpdateException` y `Exception` general devolviendo `CommonErrors.DatabaseError` / `CommonErrors.InternalServerError`.

## 3. Backend - Controller y permisos

- [x] 3.1 Agregar endpoint `[HttpPost("bulk-upload")] [Consumes("multipart/form-data")] [RequestSizeLimit(5_000_000)]` en `ProveedoresController.cs` que reciba `IFormFile file`, valide nulo/vacío y delegue a `_proveedorService.BulkUploadAsync(file.OpenReadStream(), file.FileName)`.
- [x] 3.2 Mapear el resultado a `ApiResponse<BulkUploadResultResponse>` siguiendo el patrón existente con `result.ToActionResult(...)`.
- [x] 3.3 Registrar el permiso `proveedores.cargaMasiva` en `Shared/Constants/Permissions.cs` (sección `Proveedores`).
- [x] 3.4 Aplicar `[HasPermission(Permissions.Proveedores.CargaMasiva)]` al endpoint (siguiendo el patrón existente de `[HasPermission]`, aunque hoy esté comentado en otros endpoints; agregar comentario pendiente si la convención actual es no aplicarlo).
- [x] 3.5 Documentar el endpoint con `[SwaggerOperation]` y `[SwaggerRequestBody]` describiendo el formato del archivo (incluir nota sobre filas consecutivas para cuentas múltiples).

## 4. Frontend - Helper de CSV

- [x] 4.1 Crear `lefarma.frontend/src/utils/csv.ts` con:
  - Constante exportada `PROVEEDOR_CSV_COLUMNS` (array de `{ key, label, required, group: 'proveedor' | 'cuenta', exampleValues: string[] }`).
  - Función `buildPlantillaProveedoresCsv(): Blob` que arma el CSV con header `"<label> (requerido)"`/`"<label> (opcional)"` y **al menos 4 filas de ejemplo** cubriendo: (a) proveedor sin cuenta, (b) proveedor con una cuenta, (c+d) dos filas consecutivas del mismo proveedor con dos cuentas distintas (la segunda con columnas fiscales/contacto vacías). Codificar UTF-8 con BOM (`﻿`).
  - Función `downloadCsv(blob: Blob, filename: string): void`.
  - Función `parseProveedoresCsv(file: File): Promise<{ headers: string[]; rows: Record<string, string>[]; errorMessage?: string }>` usando `papaparse`.
- [x] 4.2 Agregar dependencia `papaparse` y `@types/papaparse` al `package.json` del frontend; `npm install`.

## 5. Frontend - Modal de carga masiva

- [x] 5.1 Crear `lefarma.frontend/src/pages/catalogos/generales/Proveedores/BulkUploadModal.tsx`:
  - Props: `{ open: boolean; setOpen: (v: boolean) => void; onImported: () => void; }`.
  - Estado interno: `file`, `preview` (primeras 10 filas), `totalRows`, `isImporting`, `result` (de tipo `BulkUploadResultResponse`).
  - Sección 1: Input file con `accept=".csv"` + drag&drop opcional + nota explicativa breve "Filas consecutivas con la misma Razón Social/RFC se agrupan como cuentas adicionales del mismo proveedor".
  - Sección 2 (al cargar archivo): tabla de previsualización con `DataTable` ligero (o tabla simple), conteo total y botón "Importar".
  - Sección 3 (post-importación): card de resumen con `proveedoresImported`/`cuentasImported`/`failedRows`/`totalRows`, tabla de errores y botón "Descargar errores CSV".
- [x] 5.2 Implementar handler `handleImport` que llama `proveedorApi.bulkUpload(file)`, muestra toast con resumen y dispara `onImported()`.
- [x] 5.3 Validación client-side: rechazar archivos > 5 MB con toast antes de subir.
- [x] 5.4 Cierre automático del modal 2 segundos después si `failedRows === 0`; manual si hubo errores.

## 6. Frontend - Integración en `ProveedoresList`

- [x] 6.1 En `ProveedoresList.tsx`, en la barra superior (junto al botón "Nuevo Proveedor"), agregar:
  - Botón "Descargar Plantilla" (icono `Download`) que invoca `downloadCsv(buildPlantillaProveedoresCsv(), 'plantilla_proveedores.csv')`.
  - Botón "Carga Masiva" (icono `Upload`) que abre el `BulkUploadModal`.
  - Envolver ambos botones con `<PermissionElement require={['proveedores.cargaMasiva']}>`.
- [x] 6.2 Agregar estado `bulkModalOpen` y montar `<BulkUploadModal open={bulkModalOpen} setOpen={setBulkModalOpen} onImported={fetchProveedores} />`.
- [x] 6.3 Agregar método `bulkUpload(file: File)` a `proveedorApi` en `lefarma.frontend/src/services/api.ts` que envía `multipart/form-data` a `POST /catalogos/Proveedores/bulk-upload`.

## 7. Permisos

- [ ] 7.1 Confirmar con producto qué roles reciben `proveedores.cargaMasiva` por defecto y aplicar la asignación (por seed en migración o en el panel de admin).
- [ ] 7.2 Si existe seed de permisos en `Infrastructure/Data/Seeders/`, agregar entrada para `proveedores.cargaMasiva`.

## 8. Validación y QA

- [ ] 8.1 Probar end-to-end: subir CSV con 5 filas válidas (cada una con una cuenta) → 5 proveedores en estatus Nuevo en la lista, cada uno con su cuenta visible al editar.
- [ ] 8.2 Probar CSV con un proveedor que tiene 3 cuentas (3 filas consecutivas) → 1 proveedor con 3 cuentas; las filas 2 y 3 con columnas fiscales vacías no deben generar error.
- [ ] 8.3 Probar CSV con mix válidas/inválidas → resumen muestra conteos correctos (`proveedoresImported`, `cuentasImported`, `failedRows`) y CSV de errores descargable.
- [ ] 8.4 Probar duplicado **no consecutivo** (`Acme` en row 1, `Otra SA` en row 2, `Acme` en row 3) → la fila 3 se reporta como duplicado con el mensaje guía.
- [ ] 8.5 Probar `FormaPagoId` inválida en una fila intermedia del grupo → sólo esa cuenta falla; las demás cuentas del proveedor y el proveedor mismo se importan.
- [ ] 8.6 Probar duplicados contra BD → mensajes específicos.
- [ ] 8.7 Probar archivo > 5 MB → rechazo client-side antes de subir y server-side como respaldo.
- [ ] 8.8 Probar CSV con BOM (exportado desde Excel) y sin BOM → ambos parsean OK.
- [ ] 8.9 Probar permisos: usuario sin `proveedores.cargaMasiva` no ve botones y endpoint devuelve 403.
- [ ] 8.10 Probar que los proveedores importados siguen el flujo de autorización (aparecen como Nuevo, se pueden autorizar/rechazar uno por uno).
- [ ] 8.11 Verificar logs/wide events: una entrada `BulkUpload` con totales (proveedores, cuentas, fallidos) por importación.
