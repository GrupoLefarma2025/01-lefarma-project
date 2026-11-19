---
fecha_creacion: 2026-11-19
fecha_modificacion: 2026-11-19
resumen: Migración del módulo de documentos y flujo de firmas de SIGMA a Lefarma como aplicación integrada (/SIGMA), reutilizando las tablas y procedimientos de la base Asokam, con identidad de Lefarma, tema aislado y almacenamiento propio de PDFs.
---

# 00001 — Migración del módulo de documentos de SIGMA a Lefarma

## Status

Accepted

> Decisión tomada el 2026-11-19 para publicar el módulo dentro de Lefarma como aplicación
> integrada (tile «SIGMA» del lanzador) sin reescribir sus siete pantallas ni mover sus
> datos fuera de la base operativa que ya usan.

## Índice

- [Status](#status)
- [Contexto](#contexto)
- [Decisión](#decisión)
  - [AD-1 — El módulo vive en la base Asokam y consume sus procedimientos](#ad-1--el-módulo-vive-en-la-base-asokam-y-consume-sus-procedimientos)
  - [AD-2 — Se conservan las rutas y los sobres JSON; la identidad es la de Lefarma](#ad-2--se-conservan-las-rutas-y-los-sobres-json-la-identidad-es-la-de-lefarma)
  - [AD-3 — No se porta la firma de usuario ni el bloqueo por firma](#ad-3--no-se-porta-la-firma-de-usuario-ni-el-bloqueo-por-firma)
  - [AD-4 — Los PDFs los mueve el servicio externo de firma, en el mismo sitio IIS](#ad-4--los-pdfs-los-mueve-el-servicio-externo-de-firma-en-el-mismo-sitio-iis)
  - [AD-5 — El acceso externo usa visitantes registrados, no JWT anónimo](#ad-5--el-acceso-externo-usa-visitantes-registrados-no-jwt-anónimo)
  - [AD-6 — Los permisos son los ya sembrados en app.Permisos](#ad-6--los-permisos-son-los-ya-sembrados-en-apppermisos)
  - [AD-7 — El tema de SIGMA se aísla bajo .sigma-theme](#ad-7--el-tema-de-sigma-se-aísla-bajo-sigma-theme)
  - [AD-8 — Rutas propias con ProtectedRoute de Lefarma](#ad-8--rutas-propias-con-protectedroute-de-lefarma)
  - [AD-9 — Almacenamiento fuera de wwwroot y correo por el canal de Lefarma](#ad-9--almacenamiento-fuera-de-wwwroot-y-correo-por-el-canal-de-lefarma)
  - [Endpoints](#endpoints)
  - [Procedimientos almacenados](#procedimientos-almacenados)
  - [Pantallas](#pantallas)
- [Fases](#fases)
- [Validación contra SIGMA](#validación-contra-sigma)
- [Consecuencias](#consecuencias)
- [Anexo: fuentes](#anexo-fuentes)

## Contexto

SIGMA es una aplicación ASP.NET Core (minimal APIs con Carter) y React Router 7 que resuelve el
flujo de **documentos con aprobadores**: una persona sube un PDF, define quién lo aprueba y en
qué orden, cada aprobador lo revisa, y el documento queda aprobado o rechazado. Alrededor de ese
flujo viven siete pantallas: inicio, subida, bandeja de firmas, detalle del flujo,
autorizados/rechazados, validación pública de firma y acceso anónimo.

La aplicación se publica hoy como sitio propio (`http://200.94.77.190:5074/SIGMA`) y comparte
infraestructura con Asokam: las tablas del flujo y los procedimientos que las operan viven en el
esquema `app` de la base **Asokam**. No hay carpeta, proyecto ni decisión previa de SIGMA dentro
del repositorio de Lefarma.

Lefarma ya alcanza esa base con la cadena `AsokamConnection` y el `AsokamDbContext`, y ya tiene
identidad propia (JWT con claims de usuario y permisos), un lanzador de aplicaciones, tema
Tailwind 3.4 sobre variables CSS y un canal de notificaciones por correo. Lo que no tiene es el
flujo de documentos ni sus pantallas.

La migración debe resolver cinco tensiones concretas:

1. **Datos**: mover o no las tablas y los procedimientos del flujo. Están en producción, con
   documentos e historial, y son la fuente de verdad de Asokam.
2. **Contrato**: reescribir las siete pantallas o conservar las rutas y los sobres JSON que ya
   consumen.
3. **Identidad**: SIGMA autentica con su propio proveedor OIDC y emite tokens para usuarios y
   para visitantes; Lefarma autentica con su JWT y sus permisos.
4. **Aspecto**: SIGMA usa Tailwind 4 y tokens `oklch`; Lefarma usa Tailwind 3.4 y variables CSS.
5. **Operación**: el módulo no puede romper el despliegue ni el aspecto de Lefarma, y debe
   seguir funcionando en el mismo servidor donde ya corre el servicio que mueve los PDFs.

## Decisión

El módulo de documentos de SIGMA se integra en Lefarma como una **aplicación del lanzador**
bajo la ruta `/SIGMA`, con estas reglas:

- Se **reutilizan** las tablas y los procedimientos de la base Asokam; no se copian datos ni se
  crean tablas equivalentes en la base de negocio de Lefarma.
- Se **conservan** las rutas HTTP y los sobres JSON de SIGMA que consumen las siete pantallas.
- La **identidad** de los usuarios internos es la de Lefarma (JWT y permisos); el acceso externo
  usa visitantes registrados con un ticket firmado, no un JWT anónimo.
- El **tema** de SIGMA se encapsula para no alterar la apariencia de Lefarma.
- Los **PDFs** se guardan fuera de `wwwroot` y las notificaciones salen por el canal de correo de
  Lefarma.

Las nueve decisiones de diseño se detallan a continuación. Cada una explica el **porqué**, no
solo el qué, porque las alternativas descartadas siguen siendo tentadoras para quien retome el
módulo.

### AD-1 — El módulo vive en la base Asokam y consume sus procedimientos

**Decisión.** El módulo usa la base **Asokam** (en desarrollo `AsokamDev`; en producción
`Asokam`) a través de la cadena `AsokamConnection` y del acceso Dapper `SigmaDb`. No se crean
tablas ni procedimientos nuevos en la base de negocio de Lefarma.

Los 20 procedimientos del módulo no están versionados en el repositorio de SIGMA ni en el de
Lefarma. Se extrajeron en solo lectura y se versionan como **referencia** en
`lefarma.database/sigma/referencia/00001_stored_procedures_documentos.sql`; ese archivo no se
aplica por el migrador de Lefarma ni por los despliegues, y así se declara en su cabecera.

**Porqué.** Las tablas del flujo (`app.Documentos`, `app.DocumentosConFlujo`, `app.PasosFlujo`,
`app.GruposDocumentos`, `app.DocumentosHistorial`, `app.LogNotificacionDocumento`) están
referenciadas por personas, historial y por los propios procedimientos; moverlas obligaría a una
migración de datos con ventana de corte, a reescribir los SP y a romper cualquier otra aplicación
que las consulte. Copiarlas a Lefarma crearía dos verdades que se desincronizan en cuanto SIGMA
siga operando.

Además, Lefarma **ya** abre esa base para autenticación y catálogos (`AsokamDbContext`), así que
la conexión no es nueva ni exige infraestructura adicional. Dapper se eligió sobre EF Core porque
los SP devuelven result sets con formas que no son entidades y porque el contrato que se quiere
preservar es el de los SP, no el de un modelo EF.

La extracción a `lefarma.database/sigma/` da lo que EF no da: una copia auditable de la
definición real, con huellas SHA-256, sin convertir el repositorio en dueño del esquema. En la
verificación (ver [Validación contra SIGMA](#validación-contra-sigma)) las definiciones
resultaron idénticas byte a byte entre `AsokamDev` y `Asokam`.

**Consecuencia práctica.** El módulo depende de que los SP existan en la base destino. Si algún
día se cambia un SP, el cambio se hace con revisión humana sobre Asokam (primero desarrollo,
después producción) y se regenera el archivo de referencia; nunca se aplica solo desde un
despliegue de Lefarma.

### AD-2 — Se conservan las rutas y los sobres JSON; la identidad es la de Lefarma

**Decisión.** Se mantienen las rutas y la forma de las respuestas de SIGMA:

| Grupo | Rutas en SIGMA | Decisión en Lefarma |
|---|---|---|
| `/api/v2/documentos` | 16 | Se conservan 14; no se portan las dos de firma de usuario (AD-3) y se agrega `POST /acceso-externo` (AD-5) |
| `/api/documentos` | 2 | Se conservan las dos |
| `/api/email/documentos` | 3 | Se conservan 2: `autorizacion-pendiente` y `notificar`; esta última unifica sesión y visitante (la separación en dos rutas de SIGMA era para no exigir JWT) |
| `/api/auth/anonymous` | 1 | No se porta; la reemplaza `POST /api/v2/documentos/acceso-externo` |

Las respuestas mantienen el sobre `{ success, data }` / `{ success, message }` y los errores
`{ success: false, message }`, con los mismos nombres de campo que consumen las pantallas. Los
controladores nuevos viven en `Features/Sigma/Controllers/`.

**Porqué.** Las siete pantallas están escritas contra esos sobres: columnas, filtros y diálogos
leen `data`, `success`, `message`, `siguienteUsuario`, `flujoCompletado`, etc. Reescribir el
contrato obligaría a tocar cada pantalla y a volver a probar el flujo completo; conservarlo
permite portar el frontend casi tal cual y concentrar el riesgo en la capa de datos.

La identidad sí cambia, y es el único cambio de contrato deliberado: en SIGMA el token lo emite
su proveedor OIDC (`/.well-known/openid-configuration` en `OAuthModule.cs`); en Lefarma lo emite
el JWT propio, con `SamAccountName`, `Dominio` y permisos como claims. Los endpoints que en SIGMA
dependían de `.RequireAuthorization()` pasan a resolver el actor con `SigmaIdentity`; los que
necesitan permiso usan `User.TienePermiso(...)` con los códigos de Lefarma.

**Qué se conserva exactamente.** Método, ruta, parámetros de ruta/consulta, campos del
formulario y claves del JSON de respuesta. Lo que no se conserva es el esquema de autenticación
del proveedor de SIGMA: el frontend de Lefarma adjunta `Authorization: Bearer <JWT>` y, para
visitantes, la cabecera `X-Sigma-Visitor` (AD-5).

### AD-3 — No se porta la firma de usuario ni el bloqueo por firma

**Decisión.** No se porta la pantalla de subir firma de usuario, ni `POST /subir-firma`, ni
`GET /mi-firma`, ni el procedimiento `app.sp_ActualizarFirmaUsuario`. Tampoco se bloquea a un
aprobador por no tener firma: `GET /usuarios-para-flujo` sigue devolviendo `tieneFirma`,
`identificadorFirma` y `pathFirma` para que la pantalla los muestre, pero la selección no se
impide.

**Porqué.** En SIGMA la «firma» de usuario es un PNG que se guarda en disco y cuya ruta se escribe
en `app.Usuarios.MetadataJson` mediante `sp_ActualizarFirmaUsuario`. Ese mecanismo no es la firma
de Lefarma: Lefarma guarda la firma del usuario cifrada en su propia base
(`config.usuario_detalle.firma_path_cifrada`, con `Features/Firmas/FirmasService` y cifrado
AES-256-GCM). Portar la pantalla crearía un **segundo puntero de firma**, sin cifrar, en otra
base, que no alimenta al servicio de firma ni a la validación de Lefarma.

El dato concreto obliga a corregir una suposición inicial: **no** hay cero firmas en
`MetadataJson`. La consulta de solo lectura encontró **4 usuarios de 228** en ambas bases con
`pathFirma` y `tieneFirma: true`; todas las rutas apuntan a carpetas locales de desarrollo
(`C:\Users\brand\...` y `D:\InepubPruebas\sigma\Firmas\...`), no a archivos de producción
utilizables. Es dato residual de pruebas. La decisión no cambia —no se porta—, pero la evidencia
se documenta tal cual para que nadie repita la suposición de «cero filas».

Además, SIGMA **no firma criptográficamente** el PDF: al aprobar, copia el archivo inicial al
firmado (`DocumentosModuleV2.cs`: «TODO: Aquí iría la lógica de firma digital del PDF» / «Por
ahora, solo copiamos el archivo inicial al firmado»). El PDF real lo gestiona el servicio externo
(AD-4). Portar la firma de usuario daría una falsa sensación de firma sin cambiar el resultado.

**Efecto en la interfaz.** El navbar y el diálogo de flujo dejan de ofrecer «subir firma». El
resto de la pantalla de flujo funciona igual: se eligen aprobadores y se ordenan. Si más adelante
se quiere firma real, se conecta con el servicio de firma o con `FirmasService`, no con
`MetadataJson`.

### AD-4 — Los PDFs los mueve el servicio externo de firma, en el mismo sitio IIS

**Decisión.** La subida, descarga, autorización y rechazo de los PDFs sin flujo se siguen
haciendo contra el servicio externo `/asokam/pdf-signature/*` de la aplicación Asokam, con base
relativa `/sisco2-1`. En desarrollo se agrega un proxy de Vite (`/sisco2-1` →
`http://200.94.77.190:5074`); en producción no hace falta proxy porque todo está en el mismo
origen.

**Porqué.** Ese servicio ya existe, ya mueve los PDFs y ya está probado con datos reales. En
producción, Lefarma se publica en la raíz del mismo sitio IIS que Asokam (`iis-027`, sitio
`sisco2-1`, URL pública `http://200.94.77.190:5074/`), y el servicio está en
`http://200.94.77.190:5074/sisco2-1/asokam/pdf-signature/*`. Al ser el mismo esquema, host y
puerto, una ruta relativa `/sisco2-1/...` evita CORS, evita cookies de terceros y evita
configurar una URL absoluta distinta por ambiente.

En SIGMA esa base se configuraba como URL completa en `.env.production`
(`VITE_URL_API=http://200.94.77.190:5074/sisco2-1`). La migración usa la misma variable con valor
por defecto `/sisco2-1`, que es lo que ya hace `lefarma.frontend/src/apps/sigma/lib/httpClient.ts`
(`EXTERNAL_API_BASE`). La descarga de los PDFs del flujo, en cambio, la sirve el backend de
Lefarma desde su propio almacenamiento (AD-9), porque esos archivos no viven en el servicio
externo.

**Lo que NO se copia.** La idea de que el servicio externo «firma»: SIGMA no firma el PDF, solo
copia. El módulo migrado mantiene el mismo comportamiento y deja el TODO explícito en
`SigmaDocumentStorage.PrepararArchivoFirmado`. La validación pública de firma
(`/verificar-documento/{id}`) sí se conserva porque es del servicio externo y es la que usan los
enlaces de los correos.

### AD-5 — El acceso externo usa visitantes registrados, no JWT anónimo

**Decisión.** Los firmantes sin cuenta de Lefarma no reciben un JWT anónimo. Se registran o
reutilizan con `app.sp_CrearUsuarioAnonimo` y reciben un **ticket firmado** (HMAC-SHA256) que
viaja en la cabecera `X-Sigma-Visitor`. La sesión del visitante vive en `sessionStorage`
(`sigma.visitor`), no en `localStorage`. El ticket lo valida `SigmaVisitorTokenService`; contiene
`idUsuario`, correo y expiración, y dura 8 horas.

Los endpoints de notificación anónima validan que el correo del visitante aparezca en el
`MetadataJSON` (to/cc) del documento antes de disparar el correo. Además, el visitante solo puede
operar sobre documentos donde es creador o aprobador del mismo grupo (`SigmaDocumentAccess`).

**Porqué.** Emitir un JWT anónimo con el mismo firmante que los usuarios internos obligaría a
distinguir «anónimo» dentro de cada autorización y abriría la puerta a que un token de visitante
se use en endpoints internos. Un ticket opaco, con vida corta y una cabecera propia, separa
limpiamente los dos mundos: si no hay JWT, `SigmaIdentity` intenta el ticket; si no hay ticket,
no hay actor.

`sessionStorage` en lugar de `localStorage` hace que la sesión del visitante muera al cerrar la
pestaña, que es el comportamiento esperado para un enlace de correo en un equipo compartido.
SIGMA, en cambio, usaba su propio proveedor de tokens y guardaba la sesión en su store; el enlace
`tkn_login` metía credenciales ofuscadas en la URL y el `AuthProvider` las interceptaba. Ese
mecanismo **no se porta**: expone credenciales en el historial del navegador y en los registros
del servidor, y ya no es necesario porque el visitante se registra una vez y recibe su ticket.

La comprobación del correo contra `MetadataJSON` es un endurecimiento respecto de SIGMA: allá la
ruta anónima es `AllowAnonymous` y no compara el correo del token con los destinatarios; acá el
endpoint dispara un envío y por eso exige que el visitante esté realmente en el documento.

### AD-6 — Los permisos son los ya sembrados en app.Permisos

**Decisión.** No se siembran permisos nuevos. Se reutilizan los códigos que ya existen en
`app.Permisos` de Asokam:

| Pantalla / acción | Permiso |
|---|---|
| Subir documento | `documentos.subir` |
| Aprobar y rechazar | `documentos.aprobar` |
| Eliminar documento | `documentos.eliminar` |
| Ver todos los documentos | `documentos.ver_todos` |
| Ver los propios | `documentos.ver_propios` |
| Entrar a la bandeja | `menu.bandeja` |
| Entrar a la subida | `menu.subida` |
| Entrar al flujo | `menu.flujos` |
| Dashboard de documentos | `documentos.aprobar` (como en SIGMA) |

El tile «SIGMA» del lanzador se muestra **sin filtro de permiso**. No existe un código de
aplicación en `app.Permisos` y ocultarlo dejaría fuera a los aprobadores que no tienen permiso de
subida (que sí deben entrar a firmar).

**Porqué.** `AuthorizationConstants.cs` lo dice literal: «The source of truth is app.Permisos in
the database.» Los permisos de Lefarma se resuelven contra esa tabla en Asokam, y el proveedor
dinámico permite que un código nuevo funcione sin recompilar. Sembrar códigos nuevos duplicaría
la fuente de verdad y obligaría a mantener dos catálogos.

**Hallazgo que corrige la lectura de SIGMA.** `DocumentosModule.cs` declaraba
`"documentos.bandeja.ver.todos"`, pero ese código **no existe** en `app.Permisos` (la consulta
de solo lectura no lo devuelve). En SIGMA eso hacía que «ver todos» en la bandeja dependiera
también de `documentos.aprobar`, que sí existe. En Lefarma, «ver todos» se resuelve con
`documentos.ver_todos`; la constante `SigmaPermissions.BandejaVerTodos` del port debe alinearse
con ese código o eliminarse, y es un pendiente de la fase de verificación.

### AD-7 — El tema de SIGMA se aísla bajo .sigma-theme

**Decisión.** Los tokens visuales de SIGMA (colores `oklch`, tipografía y radios) se copian dentro
de un contenedor `.sigma-theme` que envuelve solo las pantallas del módulo. Lefarma sigue con su
tema global (Tailwind 3.4 sobre variables CSS).

**Porqué.** SIGMA usa Tailwind 4 y define `--primary: oklch(0.646 0.222 41.116)` y el resto de
tokens en `:root`; Lefarma usa Tailwind 3.4 y sus propias variables. Copiar esos tokens al
`:root` de Lefarma cambiaría botones, enlaces y estados de toda la aplicación. Aislarlos en un
contenedor conserva el aspecto de SIGMA dentro del módulo y el de Lefarma fuera, sin mantener dos
compilaciones de Tailwind.

**Costo aceptado.** Hay reglas de SIGMA que no se traducen una a una (utilidades de Tailwind 4
sin equivalente exacto). Se aceptan diferencias menores de espaciado y se corrigen dentro del
contenedor, no en el tema global.

### AD-8 — Rutas propias con ProtectedRoute de Lefarma

**Decisión.** El módulo declara sus rutas en `SigmaRoutes.tsx` con el `ProtectedRoute` de Lefarma,
montadas por el shell bajo `path="sigma"` (URL efectiva `/SIGMA/...`). No usa `createAppRoutes` ni
tiene login o dashboard propios. Dos pantallas son públicas: `acceso-externo` y
`documentos/validar-firma`. `BaseAppLogin` honra un `?return=` seguro para volver al módulo
después del login.

**Porqué.** El shell de Lefarma está pensado para aplicaciones con login y dashboard propios; este
módulo no los tiene: reutiliza el login global y su «home» es una pantalla de documento, no un
dashboard de aplicación. Forzarlo dentro de `createAppRoutes` obligaría a inventar un login
puente y a duplicar la redirección.

Las dos pantallas públicas existen por razones distintas: `acceso-externo` es el alta del
visitante (no puede exigir sesión) y `validar-firma` es la página a la que apuntan los correos de
documentos autorizados, que se abren sin sesión. En SIGMA, `validar-firma` exigía `menu.subida`;
en Lefarma se deja pública a propósito y el permiso queda solo para el ítem del menú.

`?return=` se resuelve con una lista blanca mínima: debe empezar con `/`, no puede ser `//` ni una
URL absoluta. Sin esa validación, un enlace malicioso podría sacar al usuario de Lefarma después
del login.

### AD-9 — Almacenamiento fuera de wwwroot y correo por el canal de Lefarma

**Decisión.** Los PDFs nuevos del flujo se guardan en una ruta configurable
(`Sigma:StoragePath`, por defecto `App_Data/sigma-documentos`, relativa al ContentRoot) **fuera de
`wwwroot`**. La estructura hereda la de SIGMA:
`<StoragePath>/<idDocumento>/archivo_inicial.pdf` para documentos sueltos y
`<StoragePath>/<idGrupo>/<idDocumento>_inicial.pdf` para grupos. La descarga pasa siempre por el
endpoint autenticado, nunca por una URL estática.

Los correos salen por el canal de email de Lefarma. Para los adjuntos se agregó una extensión
**aditiva**: `NotificationMessage.Data["attachments"]` acepta `NotificationAttachment` (nombre,
bytes y tipo) o rutas; `EmailNotificationChannel` los adjunta con MailKit. El resto del contrato
de notificaciones no cambió.

El envío se puede apagar con el interruptor `Sigma:DocumentosNotificaciones:EnviarCorreos`
(`true` por defecto). Con `false` el servicio **no escribe a los destinatarios reales**: si
`Sigma:DocumentosNotificaciones:CorreosDestinatariosPrueba` trae direcciones (lista, pueden ser
varias), redirige ahí todos los correos del módulo con el asunto prefijado `[PRUEBA]` y sin CC; si
la lista está vacía, no contacta al servidor SMTP, registra el correo omitido y responde éxito para
que aprobar, rechazar, subir o reenviar no fallen. Sirve para probar el flujo sin mandar correos a
los usuarios finales.

Los enlaces de los correos se arman con una sola base pública, ahora que frontend y API comparten
sitio: `Sigma:DocumentosNotificaciones:UrlBase` (sin `/api`). De ahí salen
`{UrlBase}/SIGMA/documentos/validar-firma?idDocumento={id}` y
`{UrlBase}/api/sigma/pdf-signature/pdf/{id}?descargar=true`. Antes se configuraban por separado
(`UrlValidacion` y `UrlDescargarPDF`), pero apuntaban al mismo sitio. En desarrollo la base es
`http://localhost:5173`; en producción, la raíz del sitio (`http://200.94.77.190:5074`).

Las plantillas HTML de los cuatro correos (autorización pendiente, documento subido, autorizado y rechazado) son las mismas de SIGMA —mismo encabezado de color, tarjeta de datos, botón grande y pie— para que el correo se vea igual que el original; solo cambian los enlaces, que ahora apuntan a nuestra API.

**Porqué.** Guardar PDFs bajo `wwwroot` los haría descargables por cualquiera que adivine la ruta,
sin pasar por permisos ni por el control de acceso del flujo. Una carpeta privada, fuera del
contenido estático, obliga a pasar por el endpoint que valida creador/aprobador.

El correo se reutiliza en vez de crear un segundo cliente SMTP: Lefarma ya tiene configuración,
plantillas y registro de envíos; duplicarlo obligaría a mantener dos juegos de credenciales. La
extensión de adjuntos es aditiva para no tocar los envíos existentes: quien no manda
`Data["attachments"]` sigue igual. Se adjunta el PDF original solo en el aviso de «documento
subido» (como SIGMA); en autorizado/rechazado se manda enlace de descarga.

El enlace al frontend de Lefarma evita que el correo siga apuntando a la raíz de SIGMA y que el
usuario termine en una aplicación que ya no es la dueña del flujo.

### Endpoints

Esta tabla describe el contrato que se implementa en Lefarma. «Auth» distingue sesión interna
(JWT de Lefarma) de visitante (cabecera `X-Sigma-Visitor`). Las respuestas con `{ success, … }`
son el sobre crudo de SIGMA.

#### `/api/v2/documentos` — flujo de documentos

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| POST | `/acceso-externo` | Público | `{ success, data: { idUsuario, nombreCompleto, correo, visitorToken } }` |
| GET | `/usuarios-para-flujo` | Sesión o visitante | `{ success, data: [{ usuario, nombreCompleto, tieneFirma, identificadorFirma, pathFirma }] }` |
| POST | `/crear-con-flujo` | Sesión (`documentos.subir`) | `{ success, message, data: { idDocumento } }`; 400 con `message` si falta archivo, motivo o aprobadores |
| POST | `/crear-grupo-con-flujo` | Sesión (`documentos.subir`) | `{ success, message, data: { idGrupo, cantidadArchivos } }` |
| GET | `/pendientes-firmar` | Sesión o visitante | `{ success, data: [documentos pendientes del usuario] }` |
| GET | `/mis-documentos` | Sesión o visitante | `{ success, data: [...] }`; acepta `fechaDesde` y `fechaHasta` |
| GET | `/firmados-por-mi` | Sesión o visitante | `{ success, data: [...] }` |
| GET | `/todos` | Sesión o visitante | `{ success, data: [...] }`; acepta `filtroUsuario`, `fechaDesde`, `fechaHasta`, `estatusFlujo` |
| DELETE | `/{idDocumento:guid}` | Sesión (`documentos.eliminar`) | `{ success, message }`; 400 si el SP rechaza |
| POST | `/aprobar` | Sesión (`documentos.aprobar`) | `{ success, message, data: { siguienteUsuario, flujoCompletado } }` |
| POST | `/rechazar` | Sesión (`documentos.aprobar`) | `{ success, message }` |
| GET | `/{idDocumento:guid}/flujo` | Sesión o visitante | `{ success, data: { documento, pasos: [{ orden, usuarioAprobador, estatus, fechaFirma, motivoRechazo, identificadorFirma, nombreUsuario }] } }`; 404 |
| GET | `/{idDocumento:guid}/historial-comentarios` | Sesión o visitante | `{ success, data: [...] }` |
| POST | `/{idDocumento:guid}/reenviar-notificacion` | Sesión (creador) | `{ success, message }`; 403 si no es el creador, 404, 400 si no hay pasos |
| GET | `/{idDocumento:guid}/descargar` | Sesión o visitante | PDF binario; 404 si no existe |
| — | `POST /subir-firma`, `GET /mi-firma` | — | **No portadas** (AD-3) |

#### `/api/documentos` — dashboard y bandeja

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/dashboard` | Sesión | `{ success, data: { user, statistics, userStats, activitySeries } }` |
| GET | `/bandeja/usuarios` | Sesión | `{ success, data: [{ value, label }] }` |

#### `/api/sigma/pdf-signature` — servicio de documentos (lecturas y escrituras)

La bandeja de SIGMA operaba contra el servicio externo `core-manager`
(`/asokam/pdf-signature/*`, anónimo). Todo ese contrato se trae al backend de Lefarma para que
consulte la misma base Asokam configurada en `AsokamConnection` y no dependa del sitio externo:

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/listar-documento` | Sesión | `{ success, message, data: [...], totalCount }`; filtros `soloActivos`, `estatus`, `nombreDocumento`, `subidoPorUsuario`, `fechaSubidaDesde`, `fechaSubidaHasta`, `ordenPor` |
| GET | `/pdf/{id:guid}` | Anónima | PDF binario (`application/pdf`, `Content-Disposition` attachment o inline); 404 si no existe |
| POST | `/subir-documento` | Sesión | `{ success, message, data: { idDocumento, archivo, usuario, comentario, tamano, estado } }`; 400 `{ errorCode: "KEYWORD_NOT_FOUND" }` si el PDF no trae la palabra clave |
| POST | `/autorizar-documento` | Sesión | `{ success, message, data: { idDocumento, usuario, estado: "Autorizado", hash } }` |
| POST | `/rechazar-documento` | Sesión | `{ success, message, data: { idDocumento, usuario, estado: "Rechazado" } }` |
| DELETE | `/eliminar-documento/{id:guid}` | Sesión | `{ success, message, data: { id, eliminado } }`; baja lógica (`Activo = 0`) |
| POST | `/verificar-documento/{id:guid}` | Anónima | 200 `{ data: { id, estado: "Verificado", coincidencia: true, hash } }`; 400 `{ data: { id, estado: "Fallido", coincidencia: false, hashCalculado, hashEsperado } }` |

El estampado de la firma se delega al mismo script Python de SIGMA
(`scripts/pdf_signature_replacer.py`, PyMuPDF + pyodbc), vendorizado en
`lefarma.backend/src/Lefarma.API/scripts/` junto con `assets/firma.png`. El backend lo invoca con
`SigmaPdfSignatureRunner`, que pasa las credenciales por variables de entorno (`SIGMA_PDF_DB_*`)
para no exponerlas en la línea de comandos y deriva el servidor, usuario, contraseña y base de la
cadena `AsokamConnection` (en desarrollo apunta a `AsokamDev`). No se reimplementa en .NET porque el
script aplana el PDF, cifra con AES-256 y aplica las restricciones de impresión, pasos que en .NET
obligarían a rasterizar el documento.

> La ruta `GET /pdf/{id}` y `POST /verificar-documento` son anónimas a propósito: el enlace de
> validación que viaja por correo abre esas dos rutas sin sesión, igual que en SIGMA.

> `app.sp_ObtenerDocumentos` tiene una semántica contraintuitiva: `@Estatus = 1` significa «todos»
> y `@Estatus = NULL` significa «pendientes». La bandeja deja de mandar `estatus=1` para la vista de
> pendientes (antes listaba todos los estados por este detalle del SP) y mantiene `estatus=4` para
> autorizados y rechazados.


#### `/api/email/documentos` — notificaciones

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| POST | `/autorizacion-pendiente` | Sesión interna (en SIGMA estaba abierto) | `{ message, documentosProcesados, correosEnviados, errores }`; 500 si falla |
| POST | `/notificar/{id:guid}?soloCC=` | Sesión **o** visitante con ticket; el correo debe aparecer en `MetadataJSON` | `{ message, documentoId, soloCC }`; 404/400 |

> La ruta `notificar-anonymous` de SIGMA no se porta como ruta aparte: el controlador resuelve la
> identidad con `SigmaIdentity` (claims o `X-Sigma-Visitor`) y exige que el correo del visitante
> esté entre los destinatarios del documento.

> `/api/auth/anonymous` de SIGMA no se porta. Su función la cubre `POST /api/v2/documentos/acceso-externo`.

### Procedimientos almacenados

Los 20 procedimientos del módulo, su uso y la decisión de portarlos:

| Procedimiento | Se usa en | ¿Se porta? |
|---|---|---|
| `sp_ObtenerUsuariosParaFlujo` | `GET /usuarios-para-flujo` | Sí |
| `sp_CrearDocumentoConFlujo` | `POST /crear-con-flujo` | Sí |
| `sp_CrearGrupoDocumentosConFlujo` | `POST /crear-grupo-con-flujo` | Sí |
| `sp_ObtenerDocumentosPendientesFirmar` | `GET /pendientes-firmar` | Sí |
| `sp_ObtenerMisDocumentos` | `GET /mis-documentos` | Sí |
| `sp_ObtenerDocumentosFirmadosPorMi` | `GET /firmados-por-mi` | Sí |
| `sp_ObtenerTodosLosDocumentos` | `GET /todos` | Sí |
| `sp_AprobarDocumento` | `POST /aprobar` | Sí |
| `sp_EliminarDocumentoSinFirmas` | `DELETE /{id}` | Sí |
| `sp_RechazarDocumento` | `POST /rechazar` | Sí |
| `sp_ObtenerFlujoDocumento` | `GET /{id}/flujo` | Sí |
| `sp_ObtenerHistorialComentarios` | `GET /{id}/historial-comentarios` | Sí |
| `sp_ObtenerPasosParaNotificar` | `POST /{id}/reenviar-notificacion` y notificaciones | Sí |
| `sp_ActualizarNotificacionEnviada` | `POST /{id}/reenviar-notificacion` | Sí |
| `sp_DocumentosDashboardStatistics` | `GET /api/documentos/dashboard` | Sí |
| `sp_DocumentosDashboardUserStats` | `GET /api/documentos/dashboard` | Sí |
| `sp_DocumentosDashboardSeries` | `GET /api/documentos/dashboard` | Sí |
| `sp_DocumentosBandejaUsuarios` | `GET /api/documentos/bandeja/usuarios` | Sí |
| `sp_ObtenerDocumentos` | `GET /api/sigma/pdf-signature/listar-documento` | Sí (portado del servicio externo) |
| `sp_ObtenerDocumentoDetalle` | `GET /api/sigma/pdf-signature/pdf/{id}` | Sí (portado del servicio externo) |
| `sp_GestionarDocumento` | `POST /api/sigma/pdf-signature/{subir,autorizar,rechazar}-documento` (operaciones 1, 2 y 3) | Sí (portado del servicio externo) |
| `sp_ActualizarFirmaUsuario` | `POST /subir-firma` | **No** (AD-3) |
| `sp_ObtenerFirmaUsuario` | `GET /mi-firma` | **No** (AD-3) |
| `sp_CrearUsuarioAnonimo` | `POST /acceso-externo` | Sí (existe en Asokam; no es de los 20 del módulo) |

El volcado versionado incluye los 20 procedimientos del módulo. `sp_CrearUsuarioAnonimo` se
invoca tal cual existe en Asokam y queda documentado en el anexo.

### Pantallas

Las siete pantallas y su equivalente en Lefarma. El permiso de la última columna es el del ítem
de menú; el acceso directo a la ruta puede ser más laxo (o público) cuando la pantalla lo exige.

| # | Pantalla | Ruta en SIGMA | Ruta en Lefarma | Permiso de UI |
|---|---|---|---|---|
| 1 | Inicio | `/` | `/SIGMA/home` | Ninguno (autenticado) |
| 2 | Subir documento | `/documentos/subir-pdf` | `/SIGMA/documentos/subir-pdf` | `menu.subida` |
| 3 | Bandeja de firmas | `/documentos/bandeja-firmas` | `/SIGMA/documentos/bandeja-firmas` | `menu.bandeja` |
| 4 | Flujo del documento | `/documentos/flujo` | `/SIGMA/documentos/flujo` | `menu.flujos` |
| 5 | Autorizados y rechazados | `/documentos/autorizados-rechazados` | `/SIGMA/documentos/autorizados-rechazados` | `menu.bandeja` |
| 6 | Validar firma | `/documentos/validar-firma` | `/SIGMA/documentos/validar-firma` | Público (el menú exige `menu.subida`) |
| 7 | Acceso anónimo | `/login/anonymous` | `/SIGMA/acceso-externo` | Público |

El tile del lanzador (`lefarma.frontend/src/apps/_registry.ts`) apunta a `/SIGMA/` y no declara
`permission`, para que ningún aprobador quede fuera por no tener permiso de subida (AD-6).

## Fases

El detalle operativo y los criterios verificables viven en
[tareas/00001_migracion-modulo-documentos-sigma.md](../tareas/00001_migracion-modulo-documentos-sigma.md).
Aquí queda el porqué de la secuencia:

| Fase | Qué entrega | Por qué en ese orden | Verificación principal |
|---|---|---|---|
| **F1 — Backend** | Controladores, Dapper, identidad, almacenamiento, correo y DI | Es el contrato que consumen las pantallas y donde está el riesgo real (SP, permisos, almacenamiento). Sin él, el frontend solo puede trabajar contra mocks. | `dotnet build` + smoke del flujo con un PDF |
| **F2 — Shell** | Rutas `/SIGMA`, registro del lanzador, `?return=`, proxy y `.sigma-theme` | Se puede hacer en paralelo con F1 y aísla el riesgo visual y de navegación antes de tocar pantallas. | `npm run build` + navegación login/vuelta |
| **F3 — Pantallas** | Las siete pantallas con permisos y tema | Depende de F2; con el contrato del ADR fijo puede avanzar contra F1 aunque el backend aún no esté desplegado. | `tsc`/build + matriz manual de siete pantallas |
| **F4 — Datos** | Volcado de referencia de los 20 SP y README | No bloquea a nadie y protege contra la deriva de los SP; es solo lectura, así que puede ir en paralelo desde el primer día. | 20 `CREATE OR ALTER` + huellas SHA-256 iguales |
| **F5 — Verificación** | Evidencia de integración y no regresión | Solo tiene sentido cuando F1–F4 están cerradas; mezclarla antes confunde fallos de contrato con fallos de implementación. | Matriz manual + builds + revisión del tema |

**Por qué no se empieza por las pantallas.** Son la parte más visible y la más fácil de «ver
funcionando» con datos falsos, pero el valor de la migración está en que el flujo real escriba en
Asokam y descargue el PDF correcto. Empezar por la UI retrasaría el descubrimiento de un SP
incompatible o de un permiso inexistente hasta el final, que es justo lo que el ADR quiere evitar.

**Por qué la extracción de SP va aparte.** No es una migración de esquema y no debe bloquear ni
ser bloqueada; su función es dejar evidencia y una regla de cambio, no aplicar nada. Mezclarla con
F1 haría creer que el despliegue del módulo toca la base, que es exactamente lo que no pasa.

## Validación contra SIGMA

Lo que se verificó directamente en el código y en la base, con la evidencia que lo sostiene:

### Rutas y contrato

- `IdentityProvider/Modules/Documentos/DocumentosModuleV2.cs` declara
  `app.MapGroup("/api/v2/documentos")` y las 16 rutas del flujo. Las declaraciones literales
  incluyen `group.MapPost("/subir-firma", SubirFirmaUsuario)`, `MapGet("/usuarios-para-flujo", …)`,
  `MapPost("/crear-con-flujo", …)`, `MapPost("/crear-grupo-con-flujo", …)`,
  `MapGet("/pendientes-firmar", …)`, `MapGet("/mis-documentos", …)`, `MapGet("/firmados-por-mi", …)`,
  `MapGet("/todos", …)`, `MapDelete("/{idDocumento:guid}", EliminarDocumento)`,
  `MapPost("/aprobar", AprobarDocumento)`, `MapPost("/rechazar", …)`,
  `MapGet("/{idDocumento:guid}/flujo", …)`, `MapGet("/{idDocumento:guid}/historial-comentarios", …)`,
  `MapPost("/{idDocumento:guid}/reenviar-notificacion", …)` y
  `MapGet("/{idDocumento:guid}/descargar", …)`.
- `IdentityProvider/Modules/Documentos/DocumentosModule.cs` declara el grupo `/api/documentos` y
  las dos rutas del dashboard y la bandeja.
- `IdentityProvider/Modules/EmailModule.cs` declara
  `group.MapPost("/documentos/autorizacion-pendiente", …)`,
  `group.MapPost("/documentos/notificar/{id:guid}", …)` (`.RequireAuthorization("NonAnonymousUser")`)
  y `group.MapPost("/documentos/notificar-anonymous/{id:guid}", …)` (`.AllowAnonymous()`).
- `IdentityProvider/Modules/AnonymousAuthModule.cs` declara
  `app.MapPost("/api/auth/anonymous", LoginAnonymousAsync)...AllowAnonymous()`; valida nombre y
  correo y llama a `tokenService.GenerateAnonymousTokenAsync`.

### Procedimientos y datos

- Los 20 procedimientos del módulo se localizaron por su uso literal en los dos módulos y en el
  servicio de correo. La consulta de solo lectura a `sys.sql_modules` calculó el SHA-256 de cada
  definición y los comparó entre `AsokamDev` y `Asokam`: **los 20 coinciden**. Ejemplos:
  `sp_ActualizarNotificacionEnviada` con
  `0EE640272D5E1D826FA528BDC4FE5140555DAB343C3B7F5552891896933BA758` y `sp_AprobarDocumento` con
  `8A35807BF8BF7265817D28CA3011ED3AC64092613450EA047BE34D29F8227E86`.
- La base `Asokam` expone 64 procedimientos `app.sp_*`; los otros 44 son de autenticación,
  sesión y módulos legacy. `sp_CrearUsuarioAnonimo` pertenece a ese grupo y se usa desde
  `IdentityProvider/Data/AuthRepository.Extended.cs`.
- **Corrección de evidencia sobre firmas**: la revisión inicial decía «0 filas con `pathFirma` en
  `MetadataJson`». La consulta real devuelve **4 de 228** usuarios en ambas bases con
  `tieneFirma: true`. Las rutas son locales de desarrollo, por ejemplo
  `C:\Users\brand\workplace\dev\IdentityProvider\Firmas\carlos.guzman_Artricenter_20251120110057.png`
  y `D:\InepubPruebas\sigma\Firmas\1c3_Lefarma_20261001154854.png`. No hay firmas de producción
  utilizables; la decisión AD-3 se mantiene, pero el anexo de fuentes lo deja escrito para que no
  se repita la suposición.
- `sp_ActualizarFirmaUsuario` escribe en `app.Usuarios.MetadataJson` el JSON
  `{"tieneFirma":true,"pathFirma":"…","identificadorFirma":"…"}`. El SP y la pantalla que lo
  alimentan no se portan (AD-3).

### Firma de PDFs

- `DocumentosModuleV2.cs` documenta el comportamiento real al aprobar: «TODO: Aquí iría la lógica
  de firma digital del PDF» y «Por ahora, solo copiamos el archivo inicial al firmado»; luego
  ejecuta `File.Copy(rutaInicial, rutaFirmado, true)`.
- `DocumentosModuleV2.cs` guarda con `RutaDocumentos ?? Path.Combine(Directory.GetCurrentDirectory(),
  "DocumentosConFlujo")` y `RutaFirmas ?? Path.Combine(Directory.GetCurrentDirectory(), "Firmas")`;
  el puerto reemplaza esas rutas por `Sigma:StoragePath` (AD-9).
- El servicio externo se invoca desde el frontend con
  `${apiUrl}/asokam/pdf-signature/subir-documento`, `…/listar-documento`, `…/pdf/{id}`,
  `…/autorizar-documento`, `…/rechazar-documento`, `…/eliminar-documento/{id}` y
  `…/verificar-documento/{id}`. `IdentityProvider/appsettings.json` fija
  `"UrlDescargarPDF": "http://200.94.77.190:5074/sisco2-1/asokam/pdf-signature/pdf/"`.

### Correo

- `IdentityProvider/Services/DocumentoEmailService.cs` exige `MetadataJSON` y lo deserializa a
  `DocumentoMetadata` (to/cc): «Documento {idDocumento} no tiene MetadataJSON» y «Documento
  {idDocumento} tiene MetadataJSON inválido». Con `soloCC` adjunta el PDF original; en
  autorizado/rechazado manda enlace de descarga (`UrlDescargarPDF`).
- En `DocumentosModuleV2.cs` las llamadas a notificar desde crear/aprobar/rechazar están
  comentadas; el envío real vive en los endpoints de `EmailModule`. El puerto centraliza el envío
  en `SigmaDocumentoEmailService` y lo usa también el recordatorio.
- `app.css` de SIGMA declara `@import "tailwindcss"` y los tokens `oklch` bajo `:root`
  (`--primary: oklch(0.646 0.222 41.116)`), lo que confirma la incompatibilidad de tema con
  Tailwind 3.4 de Lefarma (AD-7).

### Acceso externo

- `IdentityProvider/Modules/AnonymousAuthModule.cs` valida `NombreCompleto` y que `Correo`
  contenga `@`, y emite tokens con `GenerateAnonymousTokenAsync`. No valida que el correo
  pertenezca a un documento.
- `IdentityProvider/appsettings.json` contiene la URL de validación con `tkn_login` y `page`:
  `http://localhost:5173/login?tkn_login=…&page=documentos/bandeja-firmas`. `my-app/app/components/AuthProvider.tsx`
  intercepta `tkn_login`; ese mecanismo no se porta (AD-5).
- `my-app/.env.production` fija `VITE_APP_BASE_PATH=/SIGMA/`,
  `VITE_URL_API=http://200.94.77.190:5074/sisco2-1` y `VITE_URL_AUTH=http://200.94.77.190:5074/SIGMA`.

### Supuestos y pendientes detectados

- El archivo de referencia `lefarma.database/sigma/README.md` decía «21 procedimientos»; el volcado
  contiene **20** bloques `CREATE OR ALTER PROCEDURE`. Se documenta 20 (los del módulo) y el
  README quedó corregido. `sp_CrearUsuarioAnonimo` se invoca como SP existente en Asokam
  (no forma parte del volcado de 20 porque se verificó aparte con el script de creación).
- La pantalla `validar-firma` del port recibe el UUID a mano; el enlace del correo usa
  `?idDocumento={idDocumento}`. Falta precargar el campo desde la URL (fase de verificación).
- La constante `SigmaPermissions.BandejaVerTodos` (`documentos.bandeja.ver.todos`) no corresponde
  a un permiso sembrado. Debe alinearse con `documentos.ver_todos` o eliminarse.
- El controlador del port (`EmailDocumentosController`) unificó `notificar` y
  `notificar-anonymous` en una sola ruta que acepta sesión o visitante. Si esa unificación se
  mantiene, la tabla de endpoints debe reflejar dos rutas de correo en lugar de tres; hoy la tabla
  describe el contrato de SIGMA que el ADR decidió conservar.
- No se pudo confirmar una versión concreta del servicio externo de PDFs; se documenta por su
  ruta y su contrato, no por número de versión.

## Consecuencias

### Positivas

- Las siete pantallas se portan sin reescribir su contrato: el riesgo se concentra en la capa de
  datos y en la identidad.
- Los datos y el historial siguen en Asokam; no hay migración de datos ni ventana de corte.
- Lefarma gana el flujo de documentos con su propia identidad, sus permisos y su tema, sin
  duplicar la base ni el almacenamiento.
- Los SP quedan auditables: por primera vez hay una copia versionada con huellas y una regla
  explícita de que no se aplican desde el repositorio.
- El correo y los adjuntos usan un solo canal; no hay un segundo cliente SMTP.
- El acceso externo deja de exponer credenciales en la URL.
- Documentos y PDFs ya no dependen del sitio externo: listar, ver, subir, autorizar, rechazar,
  eliminar y verificar viven en el backend de Lefarma y usan la misma base que el dashboard.

### Negativas

- El módulo depende de que los 20 SP existan en la base destino y de que su contrato no cambie;
  una modificación silenciosa en Asokam rompería el flujo.
- Se mantienen dos mecanismos de firma en el ecosistema (la cifrada de Lefarma y la ruta de
  SIGMA, que no se porta pero sigue en los datos). La deuda queda visible en AD-3.
- El estampado del PDF requiere Python 3 con PyMuPDF y pyodbc en el servidor donde corre la API,
  más la ruta configurada en `Sigma:PdfSignature:PythonExe`; si falta, subir/autorizar fallan.
  El PDF sí se firma, aplana y cifra (ya no es una copia del inicial).
- El tema aislado puede divergir visualmente de SIGMA en utilidades de Tailwind 4 sin equivalente.
- La bandeja depende de permisos legacy (`menu.bandeja`) para tareas que no son de menú; es
  correcto para no sembrar permisos nuevos, pero no es intuitivo.

### Neutrales

- Se conservan dos familias de rutas (`/api/v2/documentos` y `/api/documentos`) porque las
  pantallas históricas las consumen por separado; unificarlas es una decisión posterior.
- `/api/email/documentos` se mantiene como API de notificaciones aunque el backend pueda enviar
  directamente; el frontend la usa y no hay motivo para retirarla ahora.
- El tile se muestra siempre: es una decisión de producto, no un descuido de permisos.

### ADRs de seguimiento sugeridos

- **Firma digital real** de PDFs y su relación con `Features/Firmas` (sustituiría el TODO de
  `SigmaDocumentStorage.PrepararArchivoFirmado`).
- **Contrato versionado del servicio externo** `/asokam/pdf-signature/*` (hoy se conoce por el
  código del frontend).
- **Unificación de las dos familias de rutas** de documentos en una sola API.
- **Alineación de permisos** (`documentos.bandeja.ver.todos` vs. `documentos.ver_todos`).

## Anexo: fuentes

Fuentes consultadas en `P:\Trabajo\SIGMA` (solo lectura) y en el repositorio de Lefarma:

| Archivo | Qué se tomó | Texto o hallazgo |
|---|---|---|
| `IdentityProvider/Modules/Documentos/DocumentosModuleV2.cs` | Las 16 rutas del flujo y su comportamiento | `var group = app.MapGroup("/api/v2/documentos")`; `.RequireAuthorization()`; `group.MapPost("/subir-firma", SubirFirmaUsuario)`; `MapPost("/aprobar", AprobarDocumento)` |
| `IdentityProvider/Modules/Documentos/DocumentosModule.cs` | Las 2 rutas de dashboard/bandeja | `MapGroup("/api/documentos")`; `DashboardViewAllPermission = "documentos.aprobar"`; `BandejaViewAllPermission = "documentos.bandeja.ver.todos"` |
| `IdentityProvider/Modules/EmailModule.cs` | Las 3 rutas de notificación y su auth | `MapPost("/documentos/notificar-anonymous/{id:guid}", …).AllowAnonymous()`; `MapPost("/documentos/notificar/{id:guid}", …).RequireAuthorization("NonAnonymousUser")` |
| `IdentityProvider/Modules/AnonymousAuthModule.cs` | Alta anónima de SIGMA | `MapPost("/api/auth/anonymous", LoginAnonymousAsync)...AllowAnonymous()`; valida `Correo.Contains('@')` |
| `IdentityProvider/Services/DocumentoEmailService.cs` | Requisito de `MetadataJSON` y adjuntos | `"Documento {idDocumento} no tiene MetadataJSON"`; con `soloCC` agrega `EmailAttachment`; en decisión manda enlace |
| `IdentityProvider/appsettings.json` | URL de validación y descarga | `"UrlDescargarPDF": "http://200.94.77.190:5074/sisco2-1/asokam/pdf-signature/pdf/"`; `UrlValidacion` con `tkn_login` |
| `IdentityProvider/Database/06_CreateDocumentosTable.sql` | Esquema de `app.Documentos` | `CREATE TABLE app.Documentos`; `PDFBinario VARBINARY(MAX) NOT NULL`; `Estatus INT NOT NULL DEFAULT 1` con CHECK 1/2/3; `MetadataJSON NVARCHAR(MAX)` |
| `IdentityProvider/Database/07_CreateDocumentosDashboard.sql` | Procedimientos de dashboard | `CREATE OR ALTER PROCEDURE [app].[sp_DocumentosDashboardStatistics]`; `sp_DocumentosDashboard…` |
| `my-app/app/routes.ts` | Las 7 pantallas | `route("documentos/subir-pdf", "routes/subida-documentos.tsx")`; `route("documentos/bandeja-firmas", "routes/bandeja.tsx")`; `route("login/anonymous", "routes/login.anonymous.tsx")` |
| `my-app/app/app.css` | Tema de SIGMA | `@import "tailwindcss";`; `--primary: oklch(0.646 0.222 41.116)` |
| `my-app/app/components/AuthProvider.tsx` | Mecanismo `tkn_login` | «Intercepta el parámetro tkn_login para autenticación automática»; `searchParams.delete("tkn_login")` |
| `my-app/.env.production` | Base de API y ruta pública | `VITE_APP_BASE_PATH=/SIGMA/`; `VITE_URL_API=http://200.94.77.190:5074/sisco2-1` |
| `my-app/app/routes/documentos.flujo.tsx` | Bloqueo por firma en SIGMA | `toast.error("No se puede escoger a este usuario porque aún no ha cargado su firma...")` |

Verificaciones de base de datos (solo lectura, 2026-11-19):

- `sys.sql_modules` con `HASHBYTES('SHA256', definition)` para los 20 SP en `Asokam` y
  `AsokamDev`: mismas huellas en ambos entornos.
- `app.Usuarios.MetadataJson` con `JSON_VALUE(..., '$.pathFirma')`: 4 filas de 228 en cada base,
  todas con rutas locales de desarrollo.

Referencias internas de Lefarma:

- `lefarma.database/sigma/README.md` y
  `lefarma.database/sigma/referencia/00001_stored_procedures_documentos.sql`: volcado de
  referencia de los SP (no se aplica).
- `lefarma.backend/src/Lefarma.API/Features/Sigma/`: `SigmaDb`, `SigmaIdentity`,
  `SigmaVisitorTokenService`, `SigmaDocumentAccess`, `SigmaDocumentStorage`,
  `SigmaDocumentoEmailService` y `Controllers/DocumentosV2Controller.cs`.
- `lefarma.frontend/src/apps/sigma/`: rutas, componentes y `lib/httpClient.ts`.
- `lefarma.frontend/src/apps/_registry.ts`: entrada del lanzador.
- `lefarma.frontend/src/apps/baseapp/BaseAppLogin.tsx`: `?return=` seguro.
- `lefarma.backend/src/Lefarma.API/Infrastructure/Data/AsokamDbContext.cs`: acceso a `app.Usuarios`
  y `app.Permisos`.
- `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/Channels/EmailNotificationChannel.cs`:
  extensión de adjuntos con `NotificationAttachment`.
