## Context

El catálogo de proveedores en `ProveedoresList.tsx` actualmente permite alta unitaria con un modal completo (`razonSocial`, `RFC`, `codigoPostal`, `regimenFiscalId`, `usoCfdi`, datos de contacto y cuentas bancarias). El alta dispara `POST /api/catalogos/Proveedores`, queda en estatus `Nuevo (1)` y espera autorización de CxP (flujo aprobar/rechazar ya existente).

La validación server-side la hace `CreateProveedorRequestValidator` (FluentValidation): razón social 3-255 chars, RFC con regex `^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3}$`, código postal 5 dígitos, email válido, etc. El servicio rechaza duplicados por razón social y RFC contra BD.

CxP ha pedido poder subir lotes (migración de 100+ proveedores desde sistemas legados, alta de sucursales nuevas) sin tener que abrir el modal 100 veces. La operación debe ser auditada (cada fila importada queda en `Nuevo` y pasa por el flujo de autorización normal — no se brinca el control existente).

**Constraints:**
- No romper el flujo de autorización: las filas importadas entran como `Nuevo`, no como `Aprobado`.
- Reusar `CreateProveedorRequestValidator` para evitar divergencia entre alta unitaria y masiva.
- La plantilla debe ser auto-descriptiva: el usuario no debe necesitar leer documentación externa para saber qué columnas son obligatorias.
- Backend en .NET 8 con EF Core; frontend en React + Vite + shadcn/ui (componentes ya existentes: `Modal`, `Button`, `Input`, `DataTable`).

## Goals / Non-Goals

**Goals:**
- Reducir tiempo de captura de lotes grandes (de N×30s a una sola subida).
- Reusar validación existente (`CreateProveedorRequestValidator`) sin duplicar reglas.
- Errores por fila visibles y exportables, sin abortar toda la importación si hay filas malas.
- Plantilla descargable que auto-documenta columnas requeridas vs opcionales.
- Mantener el flujo de aprobación CxP intacto.

**Non-Goals:**
- **No** importar carátula (archivo de imagen/PDF) — se sube manualmente después.
- **No** soportar Excel (`.xlsx`) en esta iteración — sólo CSV. Excel queda como follow-up.
- **No** mecanismo de "deshacer" la importación. Si el usuario se equivoca, debe eliminar manualmente o rechazar uno por uno.
- **No** procesar archivos > 5 MB ni > 10,000 filas en esta primera versión (límite duro server-side para evitar timeouts).
- **No** ejecutar la importación en background con polling — es síncrona y bloqueante. Con < 10k filas y validación in-memory es razonable (<30s esperados).
- **No** se aceptan filas de "cuenta adicional" cuando el proveedor está disperso en el archivo: la agrupación es estrictamente por filas **consecutivas**. Si se ve `Acme` en row 1, `Otra SA` en row 2 y `Acme` otra vez en row 3, la fila 3 se reporta como duplicado.

## Decisions

### 1. Plantilla CSV generada client-side, no server-side
**Decisión:** El botón "Descargar Plantilla" arma el CSV en el navegador con un helper en `utils/csv.ts`, sin llamar al backend.

**Por qué:** No hay estado dinámico que requiera el servidor; las columnas son fijas. Evita un round-trip y permite generar instantáneamente. La definición de columnas vive en un único objeto TS exportado (fuente de verdad) que también consume el parser de previsualización.

**Alternativa considerada:** Servir desde `GET /api/catalogos/Proveedores/csv-template`. Ventaja: misma fuente de verdad para frontend y backend. Desventaja: requiere conexión, latencia, infra extra. Punto medio: el backend valida los headers contra la misma lista pero la genera el cliente.

### 2. Parser CSV: PapaParse (frontend) + CsvHelper (backend)
**Decisión:** En frontend, usar `papaparse` (≈45 KB gzip) para parseo y previsualización. En backend, usar `CsvHelper` (NuGet, ya estándar en .NET) para parsing tolerante a delimitadores y comillas.

**Por qué:** Ambas librerías son maduras, manejan edge cases (comas dentro de comillas, BOM, encoding) y son las opciones estándar en sus ecosistemas. Evitar parser casero por errores sutiles de quoting.

**Alternativa:** Parser manual con `split(',')`. Rechazado: no maneja comillas, escape, multi-línea.

### 3. Importación síncrona en una sola transacción para las filas válidas
**Decisión:** El endpoint procesa todo el archivo síncronamente: parsea, valida todas las filas, luego inserta en BD las válidas dentro de `await using var tx = await _dbContext.Database.BeginTransactionAsync()`. Si la inserción falla a nivel BD (timeout, deadlock), se hace rollback completo y se devuelve error global.

**Por qué:** Para < 10k filas la operación termina en < 30s. Una transacción única garantiza que no quede el sistema en estado intermedio si se cae el proceso. Errores de **validación** son por fila (parcial OK), pero errores de **infraestructura** abortan todo.

**Alternativa:** Background job con queue + endpoint para consultar progreso. Diferida: complejidad innecesaria para volúmenes esperados. Si en producción vemos lotes > 10k frecuentes, se promueve a async.

### 4. Reusar `CreateProveedorRequestValidator` por fila
**Decisión:** Por cada fila del CSV se construye un `CreateProveedorRequest` y se invoca `validator.ValidateAsync(request)`. Los errores se mapean a `BulkUploadRowError { RowNumber, Field, Message }`.

**Por qué:** Garantiza paridad entre alta unitaria y masiva. Cuando se actualicen reglas (ej. nuevo límite de longitud) se reflejan automáticamente en ambos flujos.

### 5. Resolución de `RegimenFiscal` por Id (no por Clave SAT)
**Decisión:** La plantilla expone `RegimenFiscalId` (id numérico de la tabla `RegimenesFiscales`, ej. "5") en lugar de la clave SAT. El servicio carga todos los regímenes activos a memoria al inicio del batch y valida que el id exista.

**Por qué:** Los Ids son únicos en la BD y el modal de catálogos de referencia los muestra. Aceptar Id directamente evita una resolución intermedia y mantiene paridad con cómo el formulario unitario maneja la relación (selecciona régimen → guarda `RegimenFiscalId`).

### 6. Permiso nuevo `proveedores.cargaMasiva`
**Decisión:** Crear un permiso dedicado, separado de `proveedores.crear`.

**Por qué:** Algunas organizaciones quieren limitar quién puede subir lotes (riesgo mayor) sin restringir alta unitaria. Si más adelante se decide colapsar a `proveedores.crear`, es trivial; al revés sería ruptura.

### 7. Límite de tamaño y filas: 5 MB / 10,000 filas
**Decisión:** Tope duro server-side (con `[RequestSizeLimit]` en el endpoint y conteo de filas en el servicio).

**Por qué:** 10k filas a ~500 bytes/fila ≈ 5 MB. Más allá empieza a haber riesgo de timeout HTTP, presión de memoria al validar todo en RAM, y locks largos en BD. Volúmenes mayores deben justificarse para promover a flujo async.

### 8. Carátula fuera del CSV
Ver Non-Goals. La carátula (PDF/imagen) se sube por separado después porque es binario, no encaja en texto plano y rara vez se tiene al momento del alta masiva.

### 9. Cuentas bancarias: una fila = una cuenta; agrupación por filas consecutivas
**Decisión:** Cada fila del CSV puede traer columnas de cuenta bancaria opcionales (`FormaPagoId`, `BancoId`, `NumeroCuenta`, `CLABE`, `NumeroTarjeta`, `Beneficiario`, `CorreoNotificacion`). Cuando el archivo tiene **filas consecutivas** con la misma llave (`RazonSocial` + `RFC`), se interpretan así:
- La **primera** fila del grupo define el proveedor (datos fiscales, datos de contacto) y opcionalmente su primera cuenta.
- Las filas **subsecuentes** del grupo aportan **sólo** la cuenta bancaria — las columnas fiscales/contacto se ignoran (no se validan ni se mezclan).
- El grupo termina cuando la siguiente fila tiene una llave distinta o termina el archivo.

Si la columna pivote `FormaPagoId` está vacía en una fila, **no se crea cuenta** para esa fila (el proveedor sí, si es la primera fila del grupo).

**Por qué consecutivas:** Es trivial de implementar (un puntero a la fila previa), fácil de auditar visualmente cuando el usuario abre el CSV, y bloquea errores silenciosos del estilo "olvidé que ya capturé Acme arriba" — la segunda aparición dispersa se reporta como duplicado.

**Por qué la primera fila manda en datos fiscales:** Evita validar N veces lo mismo, y refleja el modelo real de la BD: un proveedor con sus datos + N cuentas. Si la segunda fila trae un RFC distinto, **se ignora** (no es error) — el parser está leyendo "más cuentas del mismo proveedor", no "otro proveedor".

**Alternativa considerada (rechazada):** Agrupar por llave aunque las filas estén dispersas. Razón de rechazo: si el usuario por accidente repite una razón social pensando que es proveedor distinto, se mezcla todo sin error. Filas consecutivas hace el bug visible.

**Alternativa considerada (rechazada):** Columna explícita `NumeroProveedor` (1, 2, 3...) para agrupar. Razón de rechazo: añade una columna que el usuario tiene que mantener correctamente; más fricción para lotes que típicamente sólo traen una cuenta por proveedor.

**Resolución de catálogos por Id:** `RegimenFiscalId`, `FormaPagoId` y `BancoId` se reciben como enteros y se validan contra HashSets de ids existentes (`RegimenesFiscales.IdRegimenFiscal`, `FormasPago.IdFormaPago`, `Bancos.IdBanco`). HashSets se cargan una vez al inicio del batch. Ids inválidos → error de fila (sólo esa cuenta falla; el proveedor padre se inserta si es válido).

**Persistencia atómica del grupo:** Si una cuenta falla validación pero el proveedor padre es válido, el proveedor se inserta sin esa cuenta (la falla se reporta como error de la fila correspondiente) **dentro de la misma transacción global**. No hay rollback parcial por grupo — la transacción única cubre todo el batch.

## Risks / Trade-offs

- **[Riesgo]** Usuario sube un CSV de Excel mal exportado (separadores `;` en lugar de `,`, encoding ISO-8859-1) → **Mitigación:** CsvHelper detecta el delimitador y soporta BOM UTF-8; documentar en la propia plantilla un comentario en la primera línea (o nota en el modal) "Guardar como CSV UTF-8". PapaParse en frontend valida formato antes de subir y muestra error útil.
- **[Riesgo]** RFC con regex actual no admite todos los casos extranjeros / RFCs genéricos (XAXX010101000) → **Mitigación:** Reusar el mismo regex que el alta unitaria. Si la regla cambia, cambia en un solo lugar. Documentar como conocido.
- **[Riesgo]** Validación toda en memoria con 10k filas puede crecer la presión de GC → **Mitigación:** Stream parsing con CsvHelper (no cargar todo el archivo a string), validar fila por fila acumulando sólo errores. 10k × 500 B = 5 MB en RAM, manejable.
- **[Riesgo]** Importación parcial (algunas filas OK, otras fallan) confunde al usuario sobre el estado final → **Mitigación:** El reporte explícito con conteos y CSV descargable de errores; mensaje claro "X importados, Y fallidos — revise el detalle".
- **[Trade-off]** Síncrono vs async: aceptamos hasta ~30s de espera con un loader; en compensación tenemos código mucho más simple y feedback inmediato.
- **[Trade-off]** Generar plantilla en cliente desacopla del backend, pero crea dos fuentes (frontend y backend) que deben quedar alineadas en columnas. **Mitigación:** El backend valida los headers recibidos contra una lista constante; si frontend cambia y backend no, el upload falla con mensaje claro.

## Migration Plan

Feature aditiva, no hay datos existentes que migrar. Pasos de deploy:

1. **Backend primero:**
   - Agregar `BulkUploadAsync` al servicio, endpoint en controller, DTOs nuevos.
   - Registrar permiso `proveedores.cargaMasiva` (semilla en migración o config de permisos).
   - Agregar dependencia `CsvHelper` si no está.
   - Deploy backend; el endpoint queda disponible pero sin UI que lo invoque.
2. **Frontend después:**
   - Helper `utils/csv.ts` (generación + parseo de previsualización).
   - Componente `BulkUploadModal.tsx`.
   - Integración en `ProveedoresList.tsx` (dos botones nuevos).
   - Deploy frontend.
3. **Permisos:** asignar `proveedores.cargaMasiva` al rol de CxP en el panel de administración.

**Rollback:** Si el feature falla en producción, ocultar los botones con un flag de permisos (quitar `proveedores.cargaMasiva` a todos los roles). El endpoint queda dormido. Para rollback total, revertir los PRs en orden inverso.

## Open Questions

- ¿El permiso `proveedores.cargaMasiva` se asigna por defecto al rol que hoy tiene `proveedores.crear`, o se reparte manualmente? (Producto decide.)
- ¿Se quiere un endpoint backend opcional `GET /csv-template` además de la generación cliente? Cabeza fría: probablemente sí, para que QA pueda probar contra "la plantilla oficial" sin abrir browser. Pendiente confirmar con líder técnico.
- ¿Logging/auditoría: se quiere registrar un evento por importación batch (quién, cuántos, cuándo) además de los eventos por proveedor? Sugerencia: sí, un `EnrichWideEvent` único de tipo `BulkUpload` con totales.
