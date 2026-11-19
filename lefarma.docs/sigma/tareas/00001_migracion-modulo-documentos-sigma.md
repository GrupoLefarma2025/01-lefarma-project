---
fecha_creacion: 2026-11-19
fecha_modificacion: 2026-11-19
resumen: Plan de fases para migrar el módulo de documentos de SIGMA a Lefarma (backend Dapper sobre Asokam, shell /SIGMA, siete pantallas, extracción de SP y verificación).
---

# 00001 — Plan de migración del módulo de documentos de SIGMA

## Status

En curso (2026-11-19)

> **Estado de ejecución:** implementado y verificado (2026-11-19). Backend compila sin errores, el frontend pasa `tsc`, `eslint` del módulo y `npm run build`, y el registro del launcher mantiene sus pruebas. Sin despliegue y sin escrituras a base de datos: queda pendiente la revisión humana.

> **Correcciones de paridad visual (2026-11-19, tras prueba del usuario):** (a) todas las rutas
> del módulo, incluidas las públicas, viven dentro del boundary `.sigma-theme`; (b) `sigma-theme.css`
> replica las 37 utilidades de opacidad de Tailwind que el tema de Lefarma no genera
> (`bg-primary/50`, `border-border/60`, gradientes `from-primary/5`→`to-primary/10`, …) con
> `color-mix(in oklab, …)`; (c) `/SIGMA` muestra una pantalla de entrada propia (login corporativo
> o acceso externo de visitante) en lugar del login genérico; (d) el visor de PDF recupera la barra
> de herramientas, impresión, descarga, apertura en pestaña y modo pantalla completa de la
> aplicación original.

> **Servicio de documentos dentro de Lefarma (2026-11-19):** la app ya no llama al sitio externo en
> ninguna operación: `GET /api/sigma/pdf-signature/listar-documento` y `GET .../pdf/{id}` ejecutan
> `app.sp_ObtenerDocumentos` y `app.sp_ObtenerDocumentoDetalle` contra la base Asokam de
> `AsokamConnection`; `POST .../subir-documento`, `.../autorizar-documento`, `.../rechazar-documento`,
> `DELETE .../eliminar-documento/{id}` y `POST .../verificar-documento/{id}` ejecutan
> `app.sp_GestionarDocumento` y el estampado de firma delegado al script Python vendorizado
> (`src/Lefarma.API/scripts/pdf_signature_replacer.py`). Para la vista de pendientes ya no se envía
> `estatus=1` porque ese valor hace que el SP devuelva todos los estados.

> Implementa la decisión [ADR-00001](../decisiones/00001_migracion-modulo-documentos-sigma.md).
> El contrato (rutas, sobres JSON, SP de Asokam, almacenamiento y tema) está fijado en el ADR;
> este documento solo ordena el trabajo y define cómo se comprueba cada fase.

## Índice

- [Status](#status)
- [Objetivo y alcance](#objetivo-y-alcance)
- [Orden de las fases](#orden-de-las-fases)
- [F1 — Backend](#f1--backend)
- [F2 — Shell del frontend](#f2--shell-del-frontend)
- [F3 — Pantallas](#f3--pantallas)
- [F4 — Datos (SP de referencia)](#f4--datos-sp-de-referencia)
- [F5 — Verificación](#f5--verificación)
- [Riesgos](#riesgos)
- [Definición de terminado](#definición-de-terminado)

## Objetivo y alcance

Dejar el módulo de documentos de SIGMA funcionando dentro de Lefarma bajo `/SIGMA`, con:

- API en `lefarma.backend/src/Lefarma.API/Features/Sigma/` que consume la base Asokam con Dapper.
- Frontend en `lefarma.frontend/src/apps/sigma/` con las siete pantallas y el tema aislado.
- Extracción de referencia de los 20 procedimientos del módulo en `lefarma.database/sigma/`.
- Sin cambios de esquema en la base de negocio de Lefarma y sin aplicar la extracción a ninguna
  base.

Queda **fuera** de esta migración: firma criptográfica real de PDFs, firma de usuario de SIGMA
(AD-3), unificación de las dos familias de rutas y siembra de permisos nuevos.

## Orden de las fases

| Fase | Depende de | Se puede paralelizar |
|---|---|---|
| F1 Backend | — | Sí, con F2 y F4 |
| F2 Shell frontend | — | Sí, con F1 y F4 |
| F3 Pantallas | F2 | Parcialmente con F1 (pantallas contra contrato fijo) |
| F4 Datos | — | Sí |
| F5 Verificación | F1, F2, F3, F4 | No |

## F1 — Backend

**Objetivo.** Exponer el contrato del ADR contra la base Asokam, con identidad de Lefarma y
almacenamiento propio.

**Entregables**

- `Features/Sigma/SigmaDb.cs`: acceso Dapper a `AsokamConnection` (consulta, primera fila,
  ejecución, escalar y multi-result set para `sp_ObtenerFlujoDocumento`).
- `Features/Sigma/Config/DocumentosNotificacionesOptions.cs`: secciones `Sigma` y
  `Sigma:DocumentosNotificaciones` (`StoragePath`, `MaxUploadBytes`, `UrlValidacion`,
  `UrlDescargarPDF`, remitente, destinatario por defecto).
- `Features/Sigma/SigmaIdentity.cs` y `SigmaVisitorTokenService.cs`: resolución del actor por JWT
  o por ticket `X-Sigma-Visitor`.
- `Features/Sigma/SigmaDocumentAccess.cs`: pertenencia del visitante al documento o a su grupo.
- `Features/Sigma/Services/SigmaDocumentStorage.cs`: guardado fuera de `wwwroot`, hash SHA-256,
  preparación del archivo firmado.
- `Features/Sigma/Services/SigmaDocumentoEmailService.cs`: notificaciones por el canal de email de
  Lefarma, con adjuntos.
- `Features/Sigma/Controllers/DocumentosV2Controller.cs`: las 15 rutas de `/api/v2/documentos`
  (16 de SIGMA menos las dos de firma, más `acceso-externo`).
- Controladores de `/api/documentos` (dashboard y bandeja) y `/api/email/documentos`
  (autorizaciones pendientes, notificar y notificar anónimo).
- Registro de dependencias en `Program.cs` (Dapper ya está en el `.csproj`; claves de
  configuración en `appsettings.json` y `appsettings.Development.json`).

**Criterios de aceptación**

- [ ] `dotnet build lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` termina con código 0.
- [ ] Swagger (`/swagger/v1/swagger.json` o la UI) lista el grupo `Sigma` con las rutas del ADR.
- [ ] Sin JWT ni ticket, un endpoint interno responde 401; con JWT válido, responde 200.
- [ ] `POST /api/v2/documentos/acceso-externo` devuelve `visitorToken` y no emite JWT.
- [ ] Un visitante solo puede leer/descargar documentos donde es creador o aprobador.
- [ ] `POST /crear-con-flujo` guarda el PDF en `Sigma:StoragePath`, fuera de `wwwroot`.
- [ ] `GET /{id}/descargar` devuelve `application/pdf`; no existe una URL estática equivalente.
- [ ] Los envíos de correo usan `EmailNotificationChannel` y adjuntan el PDF solo en `soloCC`.
- [ ] `dotnet test` no introduce fallos nuevos.

**Cómo verificar (manual, con datos de desarrollo)**

1. Iniciar el backend y autenticarse con un usuario con `documentos.subir`.
2. Subir un PDF con dos aprobadores y comprobar el archivo en `Sigma:StoragePath`.
3. Aprobar con el primer aprobador y verificar `siguienteUsuario`; rechazar en otro documento.
4. Descargar el PDF como creador y como aprobador; intentar como tercero (debe fallar).
5. Abrir el enlace de validación de un correo sin sesión y comprobar que la página pública carga.

## F2 — Shell del frontend

**Objetivo.** Montar el módulo dentro del shell de Lefarma sin alterar el resto de la aplicación.

**Entregables**

- `src/apps/sigma/SigmaRoutes.tsx`: rutas relativas al prefijo `/SIGMA`; públicas
  `acceso-externo` y `documentos/validar-firma`; protegidas las cinco restantes.
- `src/apps/_registry.ts`: entrada `sigma` con `path: '/SIGMA/'`, sin `permission`.
- `src/apps/baseapp/BaseAppRoutes.tsx`: montaje del subárbol bajo `path="sigma"`.
- `src/apps/baseapp/BaseAppLogin.tsx`: `?return=` seguro (empieza con `/`, no `//`, no URL
  absoluta).
- `src/apps/sigma/` con `lib/httpClient.ts` (API `/api`, cabeceras `Authorization` o
  `X-Sigma-Visitor`), store de sesión/visitante y `SigmaLayout`.
- `vite.config.ts`: sin proxy adicional; todo el módulo pasa por `/api`.
- Tema `.sigma-theme` con los tokens de `app.css` de SIGMA.

**Criterios de aceptación**

- [ ] `npm --prefix lefarma.frontend run build` termina con código 0 (incluye `tsc`).
- [ ] Sin sesión, `/SIGMA/home` redirige a `/login?return=/SIGMA/home`; tras entrar, vuelve a
      `/SIGMA/home` y no a `/hub`.
- [ ] `?return=//evil.example` o `?return=https://evil.example` cae en `/hub`, no fuera.
- [ ] El tile «SIGMA» aparece en el lanzador para un usuario sin `menu.subida`.
- [ ] El tema del hub y de otra aplicación no cambia al entrar y salir de `/SIGMA`.
- [ ] En desarrollo, una llamada a `/api/sigma/pdf-signature/listar-documento` responde desde el
      backend de Lefarma (sin pasar por `sisco2-1`).

## F3 — Pantallas

**Objetivo.** Portar las siete pantallas con el aspecto de SIGMA y los permisos de Lefarma.

**Entregables** (en `src/apps/sigma/routes/`)

| Pantalla | Archivo | Ruta |
|---|---|---|
| Inicio | `home.tsx` | `/SIGMA/home` |
| Subir documento | `subida-documentos.tsx` | `/SIGMA/documentos/subir-pdf` |
| Bandeja de firmas | `bandeja.tsx` | `/SIGMA/documentos/bandeja-firmas` |
| Flujo | `documentos.flujo.tsx` | `/SIGMA/documentos/flujo` |
| Autorizados/rechazados | `bandeja.autorizados-rechazados.tsx` | `/SIGMA/documentos/autorizados-rechazados` |
| Validar firma | `validar-firma.tsx` | `/SIGMA/documentos/validar-firma` |
| Acceso externo | `acceso-externo.tsx` | `/SIGMA/acceso-externo` |

Componentes compartidos: `SigmaLayout`, `app-sidebar`, `navbar`, `ProtectedRoute`,
`ProtectedComponent`, `ThemeProvider`, `theme-toggle`, `update-email-dialog` y
`components/documents/*`.

**Criterios de aceptación**

- [ ] `npm --prefix lefarma.frontend run build` termina con código 0.
- [ ] `npm --prefix lefarma.frontend run lint` no reporta errores nuevos del módulo.
- [ ] Las cinco pantallas internas respetan sus permisos de menú; las dos públicas cargan sin
      sesión.
- [ ] El sidebar no muestra «Subir» ni «Validar firma» sin `menu.subida`, pero las rutas siguen
      accesibles cuando corresponde (validar es pública).
- [ ] `validar-firma` acepta un UUID por URL (`?idDocumento=`) y deja el campo precargado.
- [ ] Subir, aprobar, rechazar, reenviar y descargar funcionan de extremo a extremo contra F1.

## F4 — Datos (SP de referencia)

**Objetivo.** Versionar la definición real de los procedimientos sin convertirla en una migración
de esquema.

**Entregables**

- `lefarma.database/sigma/referencia/00001_stored_procedures_documentos.sql`: 20 procedimientos
  del módulo, extraídos en solo lectura, con cabecera que diga que no se aplican.
- `lefarma.database/sigma/README.md`: reglas de uso (no migrador, revisión humana, regeneración).

**Criterios de aceptación**

- [ ] El archivo contiene exactamente 20 bloques `CREATE OR ALTER PROCEDURE [app].[sp_...]`.
- [ ] La cabecera declara que es referencia y que no se aplica por el migrador ni por despliegues.
- [ ] Las huellas SHA-256 de los 20 SP coinciden entre `AsokamDev` y `Asokam` (consulta de solo
      lectura a `sys.sql_modules`).
- [ ] Ningún script de esta carpeta se ejecutó en desarrollo ni en producción.
- [ ] El README y el archivo están alineados en el número de procedimientos (hoy el README dice
      21 y el volcado tiene 20; corregir el README).

## F5 — Verificación

**Objetivo.** Demostrar que el módulo funciona y que no rompe nada de Lefarma.

**Criterios de aceptación**

- [ ] Backend compila y los tests existentes pasan.
- [ ] Frontend compila y pasa lint.
- [ ] Matriz manual de las siete pantallas (con un usuario con `menu.subida`, otro solo con
      `menu.bandeja` y un visitante externo):

| Escenario | Resultado esperado |
|---|---|
| Login interno y vuelta a `/SIGMA/home` | Sesión de Lefarma; sin redirección a `/hub` |
| Subida con dos aprobadores | Documento creado; PDF en `Sigma:StoragePath` |
| Aprobación del primero | Siguiente usuario visible; flujo no completado |
| Aprobación del último | `flujoCompletado: true` |
| Rechazo | Estatus rechazado; motivo visible en el flujo |
| Descarga por tercero | 404/403, nunca el PDF |
| Acceso externo | Ticket en `sessionStorage`; llamadas con `X-Sigma-Visitor` |
| Enlace de validación sin sesión | Página pública; verificación contra el servicio externo |
| Bandeja «ver todos» | Solo con `documentos.ver_todos` |

- [ ] El hub y otra aplicación de Lefarma conservan su tema y su navegación.
- [ ] No hay escrituras nuevas en la base de negocio de Lefarma para este módulo.

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Deriva de un SP en Asokam | El flujo falla o cambia de forma silenciosa | Huellas SHA-256 en el volcado; revisión humana antes de cambiar un SP |
| `documentos.bandeja.ver.todos` no existe en `app.Permisos` | «Ver todos» nunca habilita | Usar `documentos.ver_todos`; alinear la constante o eliminarla |
| `validar-firma` no precarga el UUID del enlace | El usuario debe copiarlo a mano | Leer `idDocumento` de la URL en F3 |
| Endpoint masivo de correo abierto | Uso indebido del SMTP | Exigir sesión interna en `/api/email/documentos/autorizacion-pendiente` |
| Servicio externo de PDFs caído o cambia | Subida/descarga sin flujo y validación no responden | Contrato documentado en AD-4; error visible en la UI; no bloquear el flujo interno |
| Ruta de almacenamiento sin permisos | Subida falla en el servidor | `Sigma:StoragePath` configurable; verificar escritura en el arranque |
| Correos sin `MetadataJSON` | Notificación falla | Error 400 con mensaje; no rompe la operación de documentos |
| Dos mecanismos de firma | Confusión operativa | AD-3 lo documenta; no se porta la subida de firma |

## Definición de terminado

1. F1–F4 cumplen sus criterios con evidencia (build, lint, consultas de solo lectura y capturas
   de log si aplica).
2. F5 se ejecutó con la matriz completa.
3. El ADR y este plan siguen alineados (rutas, SP, permisos y pantallas).
4. No hay archivos fuera de `lefarma.docs/sigma/`, `lefarma.backend/src/Lefarma.API/Features/Sigma/`,
   `lefarma.frontend/src/apps/sigma/` y `lefarma.database/sigma/` tocados por esta migración,
   salvo el cableado mínimo del shell y la configuración.

> **Interruptor de correos (2026-11-19):** `Sigma:DocumentosNotificaciones:EnviarCorreos` permite apagar por completo los envíos (`false`) sin romper aprobar/rechazar/subir; el backend registra el correo omitido y responde éxito.

