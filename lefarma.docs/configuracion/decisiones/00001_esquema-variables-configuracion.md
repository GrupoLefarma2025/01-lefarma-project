---
fecha_creacion: 2026-11-04 18:00
fecha_modificacion: 2026-11-04 18:00
resumen: Módulo Configuración — esquema config con tabla maestra de variables (valor JSON tipado y cuatro destinos), bitácora append-only con idempotencia por id_operacion y restauración como cambio nuevo, catálogo de API keys externas (solo hash SHA-256), función T-SQL de lectura config.fn_obtener_variable, distribución por SSE con polling de respaldo cada 10 minutos, carga granular en el frontend y seis permisos en Asokam que quedan sin asignar a ningún rol ni usuario.
---

# 00001 — Esquema de variables de configuración

## Status

Accepted

> Decisión de diseño propia del módulo. No reemplaza ningún ADR anterior y no
> modifica tablas existentes: crea el esquema `config` (que ya existe en la base
> desde el esquema legado) con tres tablas nuevas y una función de lectura.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fase 1 — Tabla maestra y bitácora|Fase 1 — Tabla maestra y bitácora]]
- [[#Fase 2 — Tipos JSON y destinos|Fase 2 — Tipos JSON y destinos]]
- [[#Fase 3 — Clave y tipo inmutables; concurrencia optimista|Fase 3 — Clave y tipo inmutables]]
- [[#Fase 4 — Bitácora append-only y restauración como cambio nuevo|Fase 4 — Bitácora y restauración]]
- [[#Fase 5 — Distribución: SSE y polling de respaldo|Fase 5 — SSE y polling]]
- [[#Fase 6 — Carga granular del frontend|Fase 6 — Carga granular]]
- [[#Fase 7 — Función SQL de lectura|Fase 7 — Función SQL]]
- [[#Fase 8 — API keys para integraciones externas|Fase 8 — API keys]]
- [[#Fase 9 — Permisos ocultos|Fase 9 — Permisos ocultos]]
- [[#Fase 10 — Resiliencia|Fase 10 — Resiliencia]]
- [[#Fase 11 — Scripts y despliegue|Fase 11 — Scripts y despliegue]]
- [[#Validación|Validación]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

1. **Una tabla maestra y una bitácora separada.** `config.variables` guarda el
   valor vigente; `config.variables_bitacora` guarda cada cambio como una fila
   inmutable. La tabla maestra no tiene historial embebido ni columnas
   "anterior/nuevo": el historial es la bitácora.
2. **El valor vive en JSON, el tipo en una columna.** `valor_json` es
   `NVARCHAR(MAX)` validado con `ISJSON`; `tipo_dato` declara cómo interpretarlo.
   El esquema opcional (`esquema_json`) describe la forma esperada de objetos y
   arreglos.
3. **Cuatro destinos declarados por banderas.** `disponible_backend`,
   `disponible_frontend`, `disponible_sql` y `disponible_integraciones` deciden
   quién puede leer la variable. Al menos una debe estar encendida.
4. **`clave` y `tipo_dato` son inmutables.** Cambiar cualquiera de los dos exige
   crear una variable nueva y desactivar la anterior. El resto de metadatos y el
   valor sí se editan.
5. **La bitácora es append-only y la restauración es un cambio nuevo.** Restaurar
   una revisión inserta una fila con `accion = 'restaurar'` y
   `id_bitacora_origen` apuntando a la revisión restaurada; nunca borra ni
   reescribe historia.
6. **La API es el único camino de escritura.** No hay triggers de auditoría. Las
   mutaciones pasan por la API para incrementar `version`, escribir la bitácora
   con un `id_operacion` idempotente y emitir el evento SSE.
7. **Lectura SQL mediante una función de solo lectura.** `config.fn_obtener_variable`
   devuelve el valor escalar listo para `TRY_CONVERT`/`OPENJSON` y `NULL` cuando
   la variable no existe o no está disponible para SQL.
8. **Las API keys externas se guardan hasheadas.** `config.integraciones` guarda
   SHA-256 y un prefijo de búsqueda; la llave en claro se entrega una sola vez y
   no se persiste.
9. **Los permisos quedan ocultos.** Se siembran seis códigos `configuracion.*` en
   `Asokam.app.Permisos` sin asignarlos a ningún rol ni usuario.
10. **La distribución es push con respaldo pull.** SSE notifica el cambio en
    caliente; el frontend además reconcilia cada 10 minutos por si el stream se
    cayó.

## Fase 1 — Tabla maestra y bitácora

**Qué**

- `config.variables`: agregado con auditoría (`fecha_creacion`,
  `fecha_modificacion`, `id_usuario_creacion`, `id_usuario_modificacion`),
  `activo` para baja lógica, `version` y `row_version` para concurrencia.
- `config.variables_bitacora`: revisión global (`id_bitacora`), operación
  idempotente (`id_operacion`), copia de la clave, acción, JSON anterior y nuevo,
  usuario y fecha. `id_bitacora_origen` es una FK autorreferente para
  restauraciones.

**Por qué**

- Separar el valor vigente del historial mantiene la lectura de configuración en
  una sola fila por clave (índice único) y evita que la tabla maestra crezca sin
  límite. La bitácora puede crecer y archivarse sin tocar la lectura caliente.
- `id_bitacora` es monótono por `IDENTITY`, lo que da al frontend un cursor
  incremental barato (`id_bitacora > @ultimo`) y orden global de revisiones.
- `id_operacion` (`UNIQUEIDENTIFIER`, único) es la llave de idempotencia: un
  reintento de red con el mismo identificador no duplica la revisión. Es
  responsabilidad de la API generar el identificador una vez por intención de
  cambio.
- `id_bitacora_origen` permite reconstruir la cadena de una restauración sin
  duplicar el JSON de la revisión original en una tabla aparte.
- `id_usuario` no lleva FK a `Asokam.app.Usuarios`: los usuarios viven en otra
  base y SQL Server no admite FKs cross-database. La API valida el usuario del
  token antes de escribir.
- La baja es lógica (`activo = 0`) porque las variables pueden estar referenciadas
  por configuraciones de otros módulos y por consumidores externos; un DELETE
  físico rompería esas referencias y la trazabilidad.

## Fase 2 — Tipos JSON y destinos

**Qué**

`tipo_dato` acepta exactamente:

| Tipo | Interpretación | Valor JSON esperado |
|---|---|---|
| `string` | Texto corto | Cadena JSON |
| `text` | Texto largo | Cadena JSON |
| `integer` | Entero | Número sin decimales |
| `decimal` | Decimal | Número |
| `boolean` | Booleano | `true` / `false` |
| `date` | Fecha | Cadena `YYYY-MM-DD` |
| `time` | Hora | Cadena `HH:mm[:ss]` |
| `datetime` | Fecha y hora | Cadena ISO-8601 |
| `enum` | Uno de un conjunto | Cadena |
| `object` | Objeto | Objeto JSON |
| `array` | Arreglo | Arreglo JSON |
| `json` | JSON libre | Cualquier JSON válido |

`valor_json` y `esquema_json` se validan con `ISJSON`. `CK_variables_destino`
exige al menos una bandera de destino encendida.

**Por qué**

- Un solo tipo de columna (`NVARCHAR(MAX)`) con validación `ISJSON` evita doce
  columnas opcionales y permite que el mismo motor sirva para escalares,
  objetos y arreglos.
- El tipo explícito es lo que hace posible la función SQL: sin él no se puede
  decidir entre devolver el JSON completo (objeto/arreglo) o el escalar sin
  comillas (texto, número, booleano).
- Los destinos son banderas y no una tabla de permisos por variable porque son
  parte del contrato de la variable, no una asignación por usuario. La API los
  expone como filtros; los consumidores solo ven lo que su destino permite.
- Exigir al menos un destino evita variables "muertas" que nadie puede leer y
  obliga a decidir el alcance al crear.

## Fase 3 — Clave y tipo inmutables; concurrencia optimista

**Qué**

- `clave` es `NVARCHAR(200) NOT NULL` con `UNIQUE`.
- `tipo_dato` no se puede cambiar por API una vez creada la variable.
- `version` se incrementa en cada mutación; `row_version` (`ROWVERSION`) detecta
  escrituras concurrentes a nivel de fila.

**Por qué**

- La clave es el contrato público: la usan la API, la función SQL y los
  consumidores externos. Renombrarla en caliente rompería a todos sin aviso.
- Cambiar el tipo tampoco es seguro: un `string` que pasa a `integer` invalida
  `TRY_CONVERT`, los parsers del frontend y los esquemas de integración. La
  evolución correcta es una variable nueva con la clave nueva y la anterior
  desactivada; la bitácora conserva ambas historias.
- `version` es la comprobación de negocio (el cliente envía la versión que leyó);
  `row_version` es la red de seguridad de la base ante dos escritores que
  esquivan la comprobación. Se usan las dos porque la primera da un error
  legible y la segunda impide la pérdida silenciosa de un cambio.
- La comparación de `clave` sigue la collation de la base (habitualmente
  case-insensitive). Es el comportamiento esperado del catálogo; si un ambiente
  usa collation case-sensitive, las claves con distinta caja serían distintas.

## Fase 4 — Bitácora append-only y restauración como cambio nuevo

**Qué**

- `accion` acepta `crear`, `actualizar`, `desactivar`, `reactivar`, `restaurar`.
- `datos_anteriores_json` es `NULL` en `crear`; en el resto guarda el estado
  previo. `datos_nuevos_json` siempre guarda el estado resultante.
- `id_bitacora_origen` solo se llena en `restaurar`.
- No existen triggers sobre la bitácora ni sobre la tabla maestra.

**Por qué**

- Append-only significa que la historia no se corrige: se agrega. Un UPDATE o un
  DELETE sobre la bitácora destruiría la evidencia y haría imposible auditar
  quién cambió qué.
- Restaurar como cambio nuevo (en vez de "volver al estado anterior" borrando
  filas) mantiene la línea de tiempo completa y permite ver que hubo una
  restauración, quién la hizo y de qué revisión salió.
- No hay trigger de auditoría en `config.variables` porque la API ya escribe la
  bitácora. Un trigger duplicaría filas, no conocería `id_operacion` (no podría
  ser idempotente) y no podría emitir SSE. Además, un trigger haría que las
  escrituras directas parecieran soportadas, cuando no lo están.
- `datos_anteriores_json` y `datos_nuevos_json` guardan el estado completo, no un
  diff: el diff se puede calcular al leer y el estado completo permite restaurar
  sin reconstruir la cadena.
- La bitácora no se borra al desactivar una variable; la clave se copia en cada
  fila para que el historial siga siendo legible aunque la tabla maestra cambie
  de nombre en el futuro.

## Fase 5 — Distribución: SSE y polling de respaldo

**Qué**

- La API reutiliza el stream SSE autenticado existente y soporta varias
  conexiones simultáneas por usuario (varias pestañas o equipos).
- Al confirmar una mutación visible para frontend, la API publica únicamente la
  nueva revisión; nunca envía valores ni claves por el stream.
- El frontend reconcilia cada 10 minutos con `id_bitacora > @ultimo`, aunque el
  stream esté conectado.

**Por qué**

- SSE da latencia baja sin el costo de un WebSocket y funciona con la
  infraestructura HTTP actual (proxies incluidos). El evento es una notificación,
  no la fuente de verdad: el cliente vuelve a leer la variable.
- El polling de 10 minutos cubre los casos que SSE no cubre: stream caído, proxy
  que corta conexiones largas, pestaña suspendida por el navegador y errores de
  reconexión. Sin él, un cliente con el stream roto quedaría con configuración
  vieja indefinidamente.
- La reconciliación es incremental por `id_bitacora`, no por timestamp: los
  timestamps pueden repetirse o moverse con el reloj, el `IDENTITY` no.
- El evento SSE no transporta el valor completo para no filtrar configuración
  sensible a clientes que no la pueden leer; solo indica que hay una revisión
  nueva.

## Fase 6 — Carga granular del frontend

**Qué**

- Cada hook `useConfig` declara la clave que consume y las claves de una misma
  pantalla se agrupan en una sola petición.
- El store del frontend carga solo las claves solicitadas, las conserva en
  `localStorage` y las mantiene al día con SSE, reconexión y polling.
- Al entrar a una ruta se confirma el valor de sus claves aunque exista caché;
  el valor previo se muestra inmediatamente mientras se confirma.
- Una variable `disponible_frontend = 0` no se entrega al navegador.

**Por qué**

- El módulo de configuración puede crecer a cientos de variables; cargar todo el
  catálogo al iniciar la aplicación castiga el arranque y filtra valores que la
  pantalla no necesita.
- El manifiesto por pantalla hace explícita la dependencia: si una pantalla
  empieza a usar una clave nueva, se ve en el código y no en un JSON global
  imposible de auditar.
- La bandera `disponible_frontend` es la frontera de seguridad: una variable de
  backend o de integración no debe viajar al navegador aunque el usuario tenga
  `configuracion.view`.
- La invalidación por clave (no recargar todo) mantiene la UI estable: un cambio
  en `viaticos.km` no re-renderiza la pantalla de nómina.

## Fase 7 — Función SQL de lectura

**Qué**

`config.fn_obtener_variable(@clave NVARCHAR(200)) RETURNS NVARCHAR(MAX)`:

- Filtra `activo = 1 AND disponible_sql = 1`.
- Devuelve `NULL` si no existe o no está disponible.
- `object`, `array`, `json`: devuelve `valor_json` completo.
- `boolean`: `'1'` o `'0'` (acepta `true`/`false` o `1`/`0` en el JSON).
- `string`, `text`, `date`, `time`, `datetime`, `enum`: escalar sin comillas.
- `integer`, `decimal`: token numérico sin comillas.
- Usa `OPENJSON` para extraer el escalar (`JSON_VALUE` se limita a 4000
  caracteres y devolvería `NULL` en un `text` largo).

**Por qué**

- Los procesos SQL (jobs, procedimientos, vistas) no pueden llamar a la API. Sin
  esta función cada equipo leería `valor_json` a mano y repetiría la lógica de
  "sin comillas", "booleano a 1/0" y "solo si está disponible para SQL".
- `SCHEMABINDING` protege el contrato: la función obliga a pensar dos veces antes
  de alterar las columnas que usa. Agregar columnas nuevas no molesta.
- Devolver `NULL` en vez de lanzar un error permite que el consumidor decida el
  fallback (`COALESCE`), que es lo que necesita un job que arranca antes de que
  el catálogo esté sembrado.
- No se usa `JSON_VALUE` para el escalar porque su límite de 4000 caracteres es
  incompatible con `text`. `OPENJSON` devuelve `NVARCHAR(MAX)` y desescapa la
  cadena.
- La comparación de booleanos normaliza con `LOWER`/`TRIM` y no usa `CONVERT`
  dependiente de idioma. Los números se devuelven como token JSON, sin
  `CONVERT` a `float`/`decimal`, para no perder precisión ni cambiar la escala.
  El token usa punto decimal (JSON); si el consumidor convierte a `decimal`,
  debe usar una cultura invariante (`PARSE ... USING 'en-US'`) porque
  `CONVERT` depende de `SET LANGUAGE`.
- **Rendimiento**: la función resuelve por el índice único de `clave`, pero no se
  inlinea de forma fiable. Invocarla por fila en un `SELECT` grande multiplica
  lecturas. El uso correcto es leerla una vez en una variable o hacer `JOIN`
  contra `config.variables`.

## Fase 8 — API keys para integraciones externas

**Qué**

- `config.integraciones` guarda `nombre`, `prefijo_llave` (único), `hash_llave`
  (`CHAR(64)`, único), `claves_permitidas_json`, `activo`, `fecha_expiracion` y
  `ultima_utilizacion`.
- La llave en claro se genera y se entrega una sola vez; la base solo recibe el
  SHA-256 hexadecimal.
- `prefijo_llave` permite identificar la integración en logs sin escribir el hash
  completo.

**Por qué**

- Guardar la llave en claro convierte un respaldo o un `SELECT` accidental en una
  filtración. El hash permite verificar la llave presentada sin poder
  reconstruirla.
- El prefijo único acelera la búsqueda y hace legible el log de auditoría; el
  hash completo se compara después.
- `claves_permitidas_json` limita el alcance (operaciones o recursos) por
  integración; el esquema de ese JSON lo define el módulo, no la tabla.
- `fecha_expiracion` y `ultima_utilizacion` permiten detectar llaves olvidadas;
  `activo = 0` las revoca sin borrarlas. La tabla no guarda historial de
  llaves: la API actual crea y revoca; si más adelante se agrega rotación,
  sustituirá el hash en la misma fila y el rastro quedará en los logs, no en la
  base.
- `activo = 0` revoca sin borrar, igual que en las variables.

## Fase 9 — Permisos ocultos

**Qué**

Seis códigos en `Asokam.app.Permisos`, categoría `Configuración`, recurso
`configuracion`:

| Código | Acción |
|---|---|
| `configuracion.view` | Ver variables y su estado |
| `configuracion.create` | Crear variables |
| `configuracion.update` | Editar valor y metadatos |
| `configuracion.history` | Consultar la bitácora |
| `configuracion.restore` | Restaurar una revisión |
| `configuracion.api_keys` | Administrar API keys |

El script `0002` **no inserta filas en `app.RolesPermisos` ni en
`app.UsuariosPermisos`**.

**Por qué**

- Los permisos viven en Asokam (dev `AsokamDev`, prod `Asokam`), no en Lefarma.
  El script se ejecuta con la conexión de Lefarma y resuelve la base hermana por
  `DB_NAME()`; cualquier base distinta de `Lefarma`, `LefarmaDev` o `LefarmaDev2`
  aborta para no sembrar en el Asokam equivocado.
- No asignar es una decisión de producto: el módulo debe quedar invisible hasta
  que se decida qué rol lo administra. Sembrar permisos y asignarlos en el mismo
  script haría que el módulo apareciera a medio construir.
- **Consecuencia importante**: en este sistema `SuperAdministrador` no tiene un
  bypass de código; su acceso total viene de tener todos los permisos asignados
  (ver `legacy/026`). Tras aplicar `0002`, nadie —incluido SuperAdministrador—
  verá el módulo hasta que se haga una asignación explícita y separada. Eso es
  intencional y queda como decisión pendiente del usuario.
- Separar `api_keys` de `view/update` permite dar administración de llaves a un
  rol técnico sin darle acceso a la configuración funcional.

## Fase 10 — Resiliencia

**Qué**

- Lectura tolerante a fallos: clave inexistente o no disponible devuelve `NULL`
  (SQL) o un valor por defecto declarado por el consumidor (API/frontend).
- Escritura idempotente por `id_operacion`.
- Concurrencia optimista por `version` + `row_version`.
- SSE con reconexión y polling de respaldo.
- Baja lógica en lugar de borrado.
- Sin triggers: un fallo de la API no deja la bitácora a medias porque la
  transacción de la API cubre tabla maestra + bitácora.

**Por qué**

- La configuración no debe ser un punto único de fallo. Si el catálogo no
  responde, la aplicación sigue arrancando con defaults; si una variable no
  existe, se usa el fallback y se registra el aviso, no se lanza una excepción
  global.
- La idempotencia importa en redes móviles y reintentos automáticos: el mismo
  `id_operacion` debe producir una sola revisión.
- `version`/`row_version` evitan el clásico "dos administradores guardan a la
  vez y uno pierde el cambio".
- El polling de 10 minutos es la red de seguridad del stream; no se depende de
  que SSE esté siempre vivo.
- La baja lógica permite reactivar sin recrear la clave y conserva las
  referencias de los consumidores.

## Fase 11 — Scripts y despliegue

**Qué**

- `lefarma.database/configuracion/0001_20261104-1800_configuracion_esquema-base.lefarma.sql`:
  esquema, tablas, constraints, índices y función.
- `lefarma.database/configuracion/0002_20261104-1810_configuracion_permisos.lefarma.sql`:
  seed idempotente de los seis permisos en Asokam, sin asignaciones.
- `Routing` de `migrations.config.json` incluye `configuracion`; sin esa entrada
  el migrador no aplica la carpeta (fail-closed).

**Por qué**

- La carpeta nueva debe declararse en `Routing` o DbUp la ignora por diseño. El
  sufijo `.lefarma` en el nombre limita ambos scripts a las bases Lefarma*; la
  escritura de permisos va a Asokam por nombre dinámico.
- Los dos scripts están separados porque tienen destinos y privilegios
  distintos: `0001` solo necesita DDL en Lefarma; `0002` necesita escribir en
  Asokam. Si el login no tiene permiso sobre Asokam, `0001` puede aplicarse y
  `0002` queda pendiente sin bloquear el esquema.
- `0001` usa una transacción para el DDL de tablas; la función va en su propio
  batch porque `CREATE FUNCTION` debe ser la primera sentencia del batch. Es
  idempotente (`CREATE OR ALTER`) y se puede reejecutar.
- `0002` usa una transacción única y `XACT_ABORT ON`; si el conteo final no es 6,
  revierte y falla ruidosamente.

## Validación

Diseño validado contra el estado actual del repositorio:

- El esquema `config` ya existe en la base (`legacy/000_create_tables.sql`), pero
  no tiene tablas con estos nombres: no hay colisión.
- El migrador resuelve la familia por el sufijo del archivo y aplica la carpeta
  solo si está en `Routing`; `configuracion` se agregó sin tocar las demás rutas
  ni ambientes (`Lefarma.Migrations/Program.cs`, `GetAppFolders` y
  `ParseSuffix`).
- `Asokam.app.Permisos` tiene `CodigoPermiso`, `NombrePermiso`, `Descripcion`,
  `Categoria`, `Recurso`, `Accion`, `EsActivo` y `FechaCreacion` con default
  (`PermisoConfiguration.cs`), que es lo que usa `0002`.
- La autenticación resuelve permisos por rol y por usuario desde
  `app.RolesPermisos`/`app.UsuariosPermisos`, sin bypass de SuperAdministrador
  (`UserPermissionService.cs` y `legacy/026`).
- `JSON_VALUE` devuelve `NULL` para escalares de más de 4000 caracteres; por eso
  la función usa `OPENJSON` (documentación de Microsoft, ver anexo).
- Revisión estática del SQL: comillas balanceadas, `GO` entre batches,
  `CREATE FUNCTION` como primera sentencia de su batch, FKs en orden de creación
  (variables antes que bitácora), `ISJSON` en todos los CHECK de JSON y cálculo
  de la base Asokam con `QUOTENAME` + `sp_executesql` parametrizado.

Pendiente de validación en ejecución (no se ejecutó ningún script):

- Aplicar `0001` en `LefarmaDev` y verificar tablas, índices y función.
- Probar la función con cada tipo (incluido `text` de más de 4000 caracteres y
  `object`), y con una clave inexistente o con `disponible_sql = 0`.
- Aplicar `0002` en `LefarmaDev`/`AsokamDev` y verificar 6 permisos y 0
  asignaciones a roles y usuarios.
- Verificar que el login de despliegue tiene permisos sobre `AsokamDev`.

## Consequences

**Positivas**

- Un solo lugar para la configuración, con contrato explícito de tipo y destino.
- Historial completo y auditable sin triggers ni tablas espejo.
- La función SQL evita que cada job reimplemente la lectura del JSON.
- Las llaves de integración no se guardan en claro.
- El frontend no carga configuración que no usa ni valores que no puede ver.
- El módulo no aparece en la navegación hasta que se decida su asignación.

**Negativas / neutrales**

- `SCHEMABINDING` obliga a `DROP FUNCTION` antes de alterar las columnas que usa;
  es el precio de blindar el contrato.
- `clave` y `tipo_dato` inmutables obligan a crear una variable nueva para
  evolucionar; la clave vieja queda desactivada.
- No hay triggers: una escritura directa por SQL deja la bitácora incompleta. Es
  una limitación conocida y documentada, no un descuido.
- La tabla de integraciones no guarda historial de llaves; la rotación se
  registra en logs, no en la base.
- Los permisos quedan sin asignar: nadie ve el módulo hasta que se haga la
  asignación explícita (incluido SuperAdministrador).
- El polling de 10 minutos puede mostrar un valor viejo hasta ese lapso si SSE
  falla.

**Follow-ups**

- Implementar la API (CRUD, bitácora, restauración, SSE, API keys) y el frontend
  con el manifiesto de claves por pantalla.
- Decidir qué rol recibe los seis permisos y hacer la asignación en un script
  separado (no en `0002`).
- Definir el esquema de `claves_permitidas_json` y el formato de la llave
  (`prefijo` + secreto) en el ADR de la API.
- Evaluar el archivado de la bitácora cuando supere un umbral operativo.

## Anexo — Fuentes

- `lefarma.database/README.md` — convención de nombres, `GO` entre batches,
  idempotencia y advertencia de no envolver todo en `BEGIN TRAN` (el migrador ya
  usa transacción por script).
- `lefarma.backend/src/Lefarma.Migrations/migrations.config.json` — `Routing` y
  familias por sufijo (`lefarma`, `asokam`, `*`).
- `lefarma.backend/src/Lefarma.Migrations/Program.cs` — `GetAppFolders`
  (fail-closed), `ParseSuffix`, `ParseScriptPath` y `WithTransactionPerScript`.
- `lefarma.database/legacy/000_create_tables.sql` — el esquema `config` ya existe.
- `lefarma.database/legacy/026_rol_super_administrador.sql` — *"El
  SuperAdministrador es un rol normal: tiene acceso total porque tiene asignados
  todos los permisos. No hay bypass especial ni columnas extras."*
- `lefarma.backend/src/Lefarma.API/Services/Identity/UserPermissionService.cs` —
  los permisos se leen de `RolesPermisos` + `UsuariosPermisos`, sin bypass.
- `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Auth/PermisoConfiguration.cs` —
  columnas y default de `app.Permisos`.
- Microsoft Learn, *JSON_VALUE (Transact-SQL)*: *"If the value is greater than
  4,000 characters: in lax mode, JSON_VALUE returns NULL. If you need to return
  scalar values greater than 4,000 characters, use OPENJSON instead of
  JSON_VALUE."*
- Microsoft Learn, *OPENJSON (Transact-SQL)*: devuelve `Value` como
  `nvarchar(MAX)` y requiere compatibilidad 130 o superior.
