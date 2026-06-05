## ADDED Requirements

### Requirement: Botón "Descargar Plantilla" en la lista de proveedores
El sistema DEBE mostrar un botón con etiqueta "Descargar Plantilla" en la barra superior de la página `ProveedoresList`, ubicado junto a los botones "Carga Masiva" y "Nuevo Proveedor", visible para usuarios con permiso `proveedores.crear` o `proveedores.cargaMasiva`.

#### Scenario: Descarga de plantilla CSV
- **WHEN** el usuario hace clic en "Descargar Plantilla"
- **THEN** el navegador descarga inmediatamente un archivo `plantilla_proveedores.csv` generado en el cliente (sin viaje al servidor), codificado en UTF-8 con BOM para compatibilidad con Excel, con encabezados que indiquen el estatus de cada columna como `(requerido)` o `(opcional)` entre paréntesis, y una fila de ejemplo con datos válidos representativos.

#### Scenario: Columnas de la plantilla
- **WHEN** el archivo se genera
- **THEN** contiene exactamente las siguientes columnas en este orden:
  - **Datos del proveedor**: `RazonSocial (requerido)`, `RFC (opcional)`, `CodigoPostal (opcional)`, `RegimenFiscalId (opcional)`, `UsoCfdi (opcional)`, `PersonaContactoNombre (opcional)`, `ContactoTelefono (opcional)`, `ContactoEmail (opcional)`, `Comentario (opcional)`.
  - **Datos de cuenta bancaria (opcionales, todas)**: `FormaPagoId (opcional)`, `BancoId (opcional)`, `NumeroCuenta (opcional)`, `CLABE (opcional)`, `NumeroTarjeta (opcional)`, `Beneficiario (opcional)`, `CorreoNotificacion (opcional)`.
- **AND** incluye al menos 3 filas de ejemplo: (1) un proveedor con datos fiscales y una cuenta bancaria; (2) un proveedor sin cuenta bancaria (columnas de cuenta vacías); (3) dos filas consecutivas del mismo proveedor para ilustrar cómo se agregan múltiples cuentas (segunda fila repite `RazonSocial` y `RFC`, deja vacías las columnas fiscales/contacto y rellena sólo las columnas de cuenta).

### Requirement: Botón "Carga Masiva" en la lista de proveedores
El sistema DEBE mostrar un botón con etiqueta "Carga Masiva" en la barra superior de la página `ProveedoresList`, ubicado entre "Descargar Plantilla" y "Nuevo Proveedor", visible sólo para usuarios con permiso `proveedores.cargaMasiva`.

#### Scenario: Abrir modal de carga
- **WHEN** el usuario hace clic en "Carga Masiva"
- **THEN** se abre un modal titulado "Carga Masiva de Proveedores" que contiene un selector de archivo limitado a `.csv`, una sección de previsualización inicialmente vacía, un botón "Validar" deshabilitado, y un botón "Importar" deshabilitado.

#### Scenario: Selección de archivo válido
- **WHEN** el usuario selecciona un archivo `.csv` cuyo tamaño es ≤ 5 MB
- **THEN** el sistema parsea el CSV en el cliente, muestra las primeras 10 filas en la tabla de previsualización con los encabezados detectados, habilita el botón "Validar", y muestra el conteo total de filas detectadas.

#### Scenario: Archivo inválido (no CSV o > 5 MB)
- **WHEN** el usuario selecciona un archivo que no es `.csv` o que excede 5 MB
- **THEN** se muestra un toast de error con la causa específica y el botón "Importar" permanece deshabilitado.

### Requirement: Importación masiva server-side
El backend DEBE exponer el endpoint `POST /api/catalogos/Proveedores/bulk-upload` que recibe `multipart/form-data` con un campo `file` conteniendo un CSV, parsea las filas, valida cada una reusando las reglas de `CreateProveedorRequestValidator`, persiste en una sola transacción los proveedores válidos, y devuelve un reporte detallado.

#### Scenario: Importación 100% exitosa
- **WHEN** todas las filas del CSV pasan validación y no hay duplicados
- **THEN** el endpoint persiste todos los proveedores con `Estatus = Nuevo (1)` junto con sus cuentas bancarias asociadas y devuelve `200 OK` con `ApiResponse<BulkUploadResultResponse>` donde `proveedoresImported` y `cuentasImported` reflejan los conteos correctos, `failedRows = 0` y `errors = []`.

#### Scenario: Importación parcial con errores por fila
- **WHEN** algunas filas pasan validación y otras fallan (formato RFC inválido, razón social duplicada, id de banco inválido, etc.)
- **THEN** el endpoint persiste sólo las entidades válidas (proveedores y/o cuentas) en una transacción única, y devuelve `200 OK` con `proveedoresImported`, `cuentasImported`, `failedRows = M`, y `errors` conteniendo un objeto por fila fallida con `rowNumber` (1-indexed, excluye header), `field` (campo que falló o `null`) y `message` (razón humana del fallo).

#### Scenario: Duplicado dentro del mismo archivo
- **WHEN** dos filas del CSV tienen la misma `RazonSocial` o el mismo `RFC` no vacío **Y** no son consecutivas (es decir, no forman un grupo de cuentas bancarias del mismo proveedor)
- **THEN** la primera ocurrencia se intenta importar; las subsecuentes se reportan como error con mensaje `"Duplicado dentro del archivo CSV — si quieres agregar más cuentas bancarias al mismo proveedor, las filas deben estar consecutivas"`.

#### Scenario: Filas consecutivas con la misma llave (agrupación válida)
- **WHEN** dos o más filas consecutivas tienen la misma `RazonSocial` **Y** el mismo `RFC` (o ambas con RFC vacío)
- **THEN** se interpretan como UN solo proveedor con múltiples cuentas bancarias; los datos fiscales y de contacto se toman de la **primera fila** del grupo y las filas siguientes aportan **sólo** la cuenta bancaria (sus columnas fiscales/contacto se ignoran sin reportar error).

#### Scenario: Duplicado contra base de datos
- **WHEN** una fila tiene una `RazonSocial` o `RFC` que ya existe en la tabla `Proveedores`
- **THEN** esa fila se reporta como error con mensaje `"Ya existe un proveedor con razón social/RFC '<valor>'"` y no se inserta.

#### Scenario: CSV vacío o sin filas de datos
- **WHEN** el CSV no contiene filas de datos (sólo header, o archivo vacío)
- **THEN** el endpoint devuelve `400 BadRequest` con mensaje `"El archivo CSV no contiene filas de datos"`.

#### Scenario: Encabezados faltantes o inválidos
- **WHEN** el CSV no incluye la columna requerida `RazonSocial` (o cualquier columna marcada como requerida en la plantilla)
- **THEN** el endpoint devuelve `400 BadRequest` con mensaje indicando exactamente qué columna(s) requerida(s) faltan.

#### Scenario: Permisos insuficientes
- **WHEN** un usuario sin permiso `proveedores.cargaMasiva` invoca el endpoint
- **THEN** el endpoint devuelve `403 Forbidden`.

### Requirement: Resolución de RegimenFiscal por Id
La importación DEBE aceptar la columna `RegimenFiscalId` (entero, ej. "5") y validar que el id exista en la tabla `RegimenesFiscales` antes de persistir.

#### Scenario: Id de régimen válido
- **WHEN** una fila trae `RegimenFiscalId = "5"` y existe un régimen con ese id
- **THEN** se persiste el proveedor con el `RegimenFiscalId` correspondiente.

#### Scenario: Id de régimen inválido
- **WHEN** una fila trae `RegimenFiscalId` que no corresponde a ningún régimen
- **THEN** la fila se reporta como error con mensaje `"Régimen fiscal con id <id> no existe"`.

#### Scenario: Id de régimen vacío
- **WHEN** la columna `RegimenFiscalId` está vacía para una fila
- **THEN** el proveedor se crea con `RegimenFiscalId = null` (la columna es opcional).

#### Scenario: Id de régimen no numérico
- **WHEN** una fila trae `RegimenFiscalId` con un valor que no es un número (ej. "abc")
- **THEN** la fila se reporta como error con mensaje `"RegimenFiscalId '<valor>' no es un número válido"`.

### Requirement: Importación de cuentas bancarias por proveedor
El sistema DEBE permitir importar cuentas bancarias junto con el proveedor en el mismo CSV usando filas consecutivas con la misma llave (`RazonSocial` + `RFC`).

#### Scenario: Una fila con cuenta bancaria
- **WHEN** una fila trae `FormaPagoId` no vacía junto con columnas de cuenta (`BancoId`, `NumeroCuenta`, etc.)
- **THEN** se crea el proveedor con UNA cuenta bancaria asociada a la forma de pago resuelta y al banco resuelto.

#### Scenario: Múltiples cuentas para el mismo proveedor
- **WHEN** N filas consecutivas tienen la misma `RazonSocial` y `RFC` y cada una trae datos de cuenta distintos
- **THEN** se crea UN proveedor con N cuentas bancarias asociadas (una por cada fila del grupo cuya columna `FormaPagoId` esté presente y sea válida).

#### Scenario: FormaPagoId vacía en una fila del grupo
- **WHEN** una fila del grupo tiene `FormaPagoId` vacía
- **THEN** no se crea cuenta para esa fila, pero el proveedor sí se crea (si es la primera fila) y las demás cuentas del grupo no se ven afectadas.

#### Scenario: FormaPagoId inválida
- **WHEN** una fila trae `FormaPagoId` que no existe en la tabla `FormasPago`
- **THEN** esa cuenta NO se inserta y se reporta como error de fila con mensaje `"Forma de pago con id <id> no existe"`; el proveedor padre sigue su curso (se inserta si es válido).

#### Scenario: BancoId inválida
- **WHEN** una fila trae `BancoId` no vacía que no existe en `Bancos`
- **THEN** la cuenta NO se inserta y se reporta como error de fila con mensaje `"Banco con id <id> no existe"`.

#### Scenario: BancoId vacía
- **WHEN** una fila trae `FormaPagoId` válida pero `BancoId` vacía
- **THEN** la cuenta se inserta con `IdBanco = null` (banco es opcional).

#### Scenario: Datos fiscales divergentes en filas del mismo grupo
- **WHEN** la fila 2 de un grupo trae valores en columnas de proveedor (RFC, RegimenFiscalId, etc.) distintos a los de la fila 1
- **THEN** esos valores se ignoran SIN reportar error — la fila se interpreta exclusivamente como "más cuenta bancaria del proveedor de la fila 1".

### Requirement: Conteo separado de proveedores y cuentas en el resultado
La respuesta `BulkUploadResultResponse` DEBE incluir conteos diferenciados para proveedores y cuentas bancarias.

#### Scenario: Estructura del response
- **WHEN** el endpoint completa su ejecución
- **THEN** la respuesta incluye los campos: `totalRows` (filas de datos en el CSV), `proveedoresImported`, `cuentasImported`, `failedRows`, y `errors` (lista de `BulkUploadRowError`).

### Requirement: Plantilla de ejemplo muestra agrupación
La plantilla descargable DEBE incluir filas de ejemplo que ilustren los tres casos: proveedor sin cuenta, proveedor con una cuenta, proveedor con múltiples cuentas (filas consecutivas).

#### Scenario: Filas de ejemplo
- **WHEN** se genera la plantilla
- **THEN** contiene al menos 4 filas de ejemplo cubriendo: (a) un proveedor sin datos bancarios, (b) un proveedor con una cuenta, (c-d) dos filas consecutivas del mismo proveedor con dos cuentas distintas (la segunda fila tiene las columnas fiscales/contacto vacías pero repite `RazonSocial` y `RFC`).


Después de invocar el endpoint, el modal de carga masiva DEBE mostrar un resumen visible del resultado y permitir descargar los errores como CSV.

#### Scenario: Resumen tras importación exitosa
- **WHEN** la respuesta indica `failedRows = 0`
- **THEN** se muestra un mensaje de éxito con los conteos de `proveedoresImported` y `cuentasImported`, se cierra el modal automáticamente tras 2 segundos y la lista de proveedores se refresca.

#### Scenario: Resumen tras importación con errores
- **WHEN** la respuesta indica `failedRows > 0`
- **THEN** se muestra una tabla dentro del modal con las filas fallidas (rowNumber, field, message), un botón "Descargar errores CSV" que genera un archivo con esa información, y la lista principal se refresca para reflejar los proveedores y cuentas importados exitosamente.

### Requirement: Permiso de carga masiva
El sistema DEBE introducir el permiso `proveedores.cargaMasiva` en el catálogo de permisos para gobernar el acceso al botón de UI y al endpoint backend.

#### Scenario: Usuario sin permiso no ve el botón
- **WHEN** un usuario sin `proveedores.cargaMasiva` carga la página `ProveedoresList`
- **THEN** los botones "Carga Masiva" y "Descargar Plantilla" no se renderizan (el `PermissionElement` los oculta).

#### Scenario: Usuario con permiso ve y usa el botón
- **WHEN** un usuario con `proveedores.cargaMasiva` carga la página
- **THEN** los botones son visibles y funcionales, y el endpoint acepta sus llamadas.
