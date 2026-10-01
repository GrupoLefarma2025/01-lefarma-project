# Plan: Firma e INE — privacidad, cifrado y trazabilidad (v3)

**Fecha:** 2026-09-30
**Estado:** v3 (convivencia con CXP) — ajustes T13–T17 implementados (builds OK), incluidos el fix de impresión (SOLICITA + loader) y Fase 2 RH completa (T6 engine + T7 creación SP, Opción B); pendiente ejecutar scripts 036/037 (el usuario) y pruebas manuales
**Basado en:** `2026-09-29-validacion-firma-ine-comprobacion.md` (comprobación con INE: se conserva). La v2 de este plan (migración de firmas legacy) queda **superseded**: sin migración y en convivencia con la versión CXP en producción.

---

## 1. Objetivo

Cerrar los puntos débiles detectados en el plan anterior y en la implementación actual:

1. **Nada expuesto en el sistema RH:** las firmas e INE del sistema nuevo pasan a carpeta privada y **cifradas en reposo** (AES-256-GCM). Las firmas legacy que usa CXP quedan fuera del alcance: siguen en la carpeta pública hasta que las versiones se junten.
2. **Retención de evidencia:** se conservan **todas las versiones autorizadas** (firma + su INE, emparejadas por remisión). Las **rechazadas se eliminan** (firma candidata + INE).
3. **Autorización estricta:** cada firma solo se sirve a quien ya puede ver el documento donde se usó; la INE solo a RH con permiso.
4. **Trazabilidad (re-print fiel):** la firma exacta usada en cada acción queda registrada en la bitácora del workflow, para que reimprimir un documento muestre la firma de ese momento y no la actual.

---

## 2. Relación con el plan anterior

| Punto | Plan 2026-09-29 (implementado) | Este plan (v3) |
|---|---|---|
| Firma vigente del sistema RH | Pública (`BasePath`, puntero `firma_path`) | Privada + cifrada, puntero `firma_path_cifrada` |
| Firma legacy (CXP) | Pública, `firma_path` | **Sin cambios**: sigue pública; contrato exclusivo de CXP |
| INE | Privada; **se borra al resolver** (aprobar o rechazar) | Privada + cifrada; **se conserva solo en versiones autorizadas**; se elimina al rechazar |
| Versiones anteriores de firma | Se borran al aprobar una nueva | **Se conservan** (versiones autorizadas) |
| Rechazadas | Firma candidata e INE borradas | Igual (se eliminan) |
| Migración de firmas existentes | (v2: CLI one-time) | **Eliminada**: el usuario legacy se trata como nuevo y re-sube firma + INE para validación |
| `HasFirma` (gates de firma) | `firma_path` no vacío | Solo `firma_path_cifrada` |
| Autorización de consulta | RH con `usuarios.firma.habilitar_cambio` | Estricta por documento (SP/OC) + excepciones (INE → RH; mi firma → propio usuario; concentrado OC → permiso de módulo) |
| Re-print | Resuelve firma **actual** por convención `{idUsuario}.png` | `datos_snapshot.firmaArchivo` (Fase 2); mientras tanto, firma vigente cifrada del actor |
| Estado de firma | JSON `firma_control` | JSON como historial; la vigente se apunta en `firma_path_cifrada` |
| Comprobación RH (aprobar/rechazar, notificar, bloqueo CERRAR) | Implementado | Se conserva sin cambios funcionales |

---

## 3. Decisiones acordadas

| # | Tema | Decisión |
|---|------|----------|
| 1 | Cifrado | Firmas **e** INE del sistema RH cifradas en reposo (AES-256-GCM), clave en configuración |
| 2 | Exposición | Firma/INE del sistema RH bajo carpeta privada; la carpeta pública legacy es de CXP |
| 3 | Retención | Solo versiones **autorizadas** (firma+INE). Rechazadas: se eliminan los archivos al rechazar (el evento `rechazo` con motivo permanece en el JSON como registro del proceso) |
| 4 | Autorización | Estricta por documento en SP y OC; INE solo RH; propia firma solo el dueño; concentrado OC con permiso de la página |
| 5 | Trazabilidad | `firmaArchivo` en `WorkflowBitacora.datos_snapshot` por acción (captura en el engine) + evento de creación |
| 6 | Modelo de datos | **Sin tabla nueva**: el JSON `firma_control` es el historial; la firma vigente del sistema RH se apunta en `firma_path_cifrada`. `{userId}_{timestamp}` es el identificador estable de versión |
| 7 | Retención legal | Plazo por definir con normas; el diseño lo permite (nombres y eventos con fecha). No se implementa depuración automática |
| 8 | **Sin migración (v3)** | Las firmas existentes no se cifran ni se mueven. Un usuario legacy se trata como **nuevo**: debe subir firma + INE y pasar comprobación de RH |
| 9 | Eliminar firma | `DeleteSignatureAsync` solo **anula `firma_path_cifrada`**; el archivo autorizado se conserva (los documentos firmados con él deben poder reimprimirse). No toca `firma_path` ni la carpeta pública (CXP) |
| 10 | Generación de PDF | El frontend debe **precargar los blobs y esperar** a que carguen antes de imprimir/exportar (SP, OC y concentrado): sin URLs públicas, las imágenes son asíncronas |
| 11 | **Orden de despliegue (v3)** | Respaldo → script 036 (columna) → limpiar `firma_control` → desplegar backend+frontend → los usuarios suben firma+INE. La carpeta pública y `firma_path` no se tocan |
| 12 | **Convivencia con CXP (v3)** | `firma_path` es contrato exclusivo de CXP (Perfil y OC leen de ahí); el sistema RH nunca lo escribe. Sin copia dual. Al juntar las versiones, quienes usaron RH ya tendrán su firma cifrada |
| 13 | **Servido estricto (v3)** | Los endpoints resuelven solo `firma_path_cifrada` (o `firmaArchivo` del snapshot). Sin fallback a firmas legacy ni a `{userId}_*` (además evita que una firma eliminada "reaparezca") |
| 14 | **`HasFirma` global (v3)** | Solo `firma_path_cifrada`, aplica a todos los módulos de la versión nueva (RH, Educación Médica, Órdenes de Compra): todo firmante debe validar su firma en RH |
| 15 | **Limpieza de datos (v3)** | Se limpian el historial `firma_control` y el puntero `firma_path_cifrada` en prod y dev: todos se tratan como si nunca hubieran subido firma (script 037) |
| 16 | **Cuadro SOLICITA (v3)** | Se sirve por el endpoint del solicitante: prefiere la firma capturada al crear la solicitud (`firmaSolicitanteArchivo`, Fase 2/T7); fallback a la firma vigente para solicitudes históricas |

---

## 4. Contexto verificado

- Versión CXP (branch `cxp-prod`, commit `cef55ca`, 2026-08-22): sin módulo Firmas ni `firma_control`.
  - `PerfilConfig.tsx:194-195` arma la URL con **el valor de `firma_path`** (`/media/archivos/{firma_path}`); `authStore` usa su presencia como `hasFirma`.
  - `AutorizacionesOC.tsx` y `EnvioConcentrado.tsx` usan la convención pública `firmas_usuarios/{id}.png` (+ `73.png` hardcodeado).
  - Su upload guarda `firmas_usuarios/{userId}{ext}` y setea `firma_path`; al borrar, elimina el archivo físico.
  - Implicación: si el sistema RH escribiera `firma_path` o limpiara la carpeta pública, rompería Perfil y OC de CXP. De ahí la separación por columnas (decisión 12).
- URLs públicas de firma de la versión nueva: eliminadas en T9–T11 (todo pasa por endpoints que devuelven blob).
- OC — el PDF del concentrado se genera en el frontend y se almacena **ya armado** como bytes en Asokam (`PDFBinario`, `OrdenCompraFirmasService.cs:543`): los envíos pasados quedan intactos. En producción las OC se siguen operando desde CXP.
- Solicitudes Personales es un módulo nuevo: no existen PDFs viejos de SP; el re-print histórico no aplica.
- PDFs que embeben firmas: `SolicitudPersonalPDF`, `VacacionesPDF`, `GoceDeSueldoPDF`, `IncapacidadPDF`, `IncidenciaPDF` (vía `firmantesDelFlujo`/`buildFirmasMap`) + `EnvioConcentradoPDF` y `OrdenCompraConcentradoPDF` (reciben URLs por props).
- Bitácora común: `WorkflowBitacora` (una fila por acción; `DatosSnapshot` JSON) la escribe `WorkflowEngine.EjecutarAccionAsync`; los eventos de creación se escriben en `SolicitudPersonalService.cs:~699` y `OrdenCompraService.cs:~496`. `HistorialWorkflowItemResponse` ya expone `datosSnapshot` al frontend.
- No existe infraestructura de cifrado en el proyecto (solo JWT).
- `config.usuario_detalle`: `firma_path` NVARCHAR(500), `firma_control` NVARCHAR(MAX). `AdminService.cs:176,211` escribe `FirmaPath` directo (queda como contrato CXP).
- Producción (`Lefarma`): RH no está desplegado; el `firma_control` existente proviene del backfill del script 027 y se limpiará (decisión 15). Hay firmas legacy en `BasePath/firmas_usuarios` que **no se tocan**.
- Estado dev tras las pruebas de migración: `LefarmaDev` con 15 filas `firmas/...`, 7 legacy y 20 `.enc` en `C:\archivos_privados\firmas`; se restaurará `firma_path` y se limpiará `firma_control` (T18).
- Precedente de imagen autenticada: `FileViewer.tsx:154` (blob) y el modal de comprobación ya implementado.

---

## 5. Almacenamiento y cifrado

| Archivo | Ubicación (bajo `ArchivosSettings:PrivatePath`) | Ciclo de vida |
|---|---|---|
| Firma autorizada | `firmas/{userId}_{yyyyMMddHHmmss}.{ext}.enc` | Se conserva siempre (todas las versiones autorizadas) |
| Firma candidata (en comprobación) | `firmas/{userId}_{yyyyMMddHHmmss}.{ext}.enc` (misma carpeta; el estado vive en el JSON) | Aprobación: pasa a ser la vigente. Rechazo: **se elimina** junto con su INE |
| Foto INE | `ine/{userId}_{yyyyMMddHHmmss}.{ext}.enc` | Aprobación: se conserva (evidencia). Rechazo: **se elimina** |

- `firma_path_cifrada` guarda el **nombre lógico sin `.enc`**; el cifrador agrega la extensión en disco.
- No hay movimientos de archivo: la candidata ya vive en `firmas/`; aprobar solo actualiza `firma_path_cifrada`; rechazar borra.
- `DeleteSignatureAsync`: solo anula `firma_path_cifrada`; el archivo autorizado se conserva.
- Resolución de firma (estricta): solo `firma_path_cifrada`. Sin puntero → 404. Sin fallback a `firma_path` ni a `{userId}_*`.
- Cifrado: `IFileCipher` (AES-256-GCM). Envelope en disco: `[magic/version][nonce 12][tag 16][ciphertext]`. Clave: `ArchivosSettings:EncryptionKey` (base64, 32 bytes; valor dev commiteado como los demás secretos).
- **Perder la clave = perder la evidencia**: documentar respaldo de la clave.

---

## 6. Flujo

1. **Remisión** (primera firma o cambio habilitado): usuario sube firma + INE → se guardan cifradas en `firmas/` e `ine/` → evento `remision` (nombres de archivo) → notificación a RH.
2. **Mientras EnComprobación**: `CERRAR` bloqueado en SP (ya implementado).
3. **Aprobar**: `firma_path_cifrada` = archivo candidato (queda como versión autorizada) + eventos `aprobacion` + `subida`; **no se borra nada** (ni la INE, ni la firma vigente anterior, que queda como versión autorizada); notificación al usuario.
4. **Rechazar** (con motivo): se eliminan firma candidata e INE; evento `rechazo` con motivo; notificación al usuario. Se requiere nueva habilitación para reintentar.
5. **Usuario legacy**: se comporta como nuevo (no tiene `firma_path_cifrada`): puede remitir sin habilitación; `HasFirma` es falso hasta que RH apruebe.
6. **Eliminar firma** (flujo existente con habilitación): solo anula `firma_path_cifrada`; el archivo autorizado **se conserva** para reimprimir documentos firmados con él.
7. **Uso**: cada acción de workflow registra en la bitácora el `firmaArchivo` del actuante (Fase 2) → re-print fiel.
8. **Consulta**: firmas servidas por endpoint autenticado con autorización por documento; INE solo RH; auditoría por wide-event.

---

## 7. Endpoints autenticados (descifran al servir)

| Endpoint | Quién | Qué sirve |
|---|---|---|
| `GET /api/firmas/mi-firma` | Autenticado (dueño) | Firma vigente propia (`firma_path_cifrada`); 404 si no tiene |
| `GET /api/firmas/bitacora/{idEvento}/imagen` | Quien puede ver la entidad del evento (SP: creador/solicitante/participante/`solicitud_personal.puede_ver_todas`; OC: reglas equivalentes) | `datos_snapshot.firmaArchivo` (Fase 2); si no está capturado, la firma vigente cifrada del actor |
| `GET /api/firmas/solicitud-personal/{id}/solicitante` | Quien puede ver la solicitud (misma regla que la bitácora) | Firma del solicitante: prefiere la capturada al crear (`firmaSolicitanteArchivo`); fallback a la vigente cifrada; 404 si no tiene. Para el cuadro SOLICITA cuando otra persona crea la solicitud |
| `GET /api/firmas/usuarios/{id}/firma` | RH (`usuarios.firma.habilitar_cambio`) u `ordenes.envio_concentrado` | Firma vigente cifrada del usuario; 404 si no tiene |
| `GET /api/firmas/usuarios/{id}/ine` | RH (`usuarios.firma.habilitar_cambio`) | INE de la última remisión; `?archivo=` validado contra el historial (anti-enumeración) |

- Cada acceso registra wide-event (quién, a quién, archivo, resultado).

---

## 8. Tareas de implementación

> **Fases:** Fase 1 (privacidad — este despliegue): T1–T5 y T9–T12 implementadas en v2; **ajustes v3 (T13–T17) implementados; T18 (datos) y T19 (pruebas manuales) pendientes**. T8 eliminada (sin migración). Fase 2 (trazabilidad — solo backend, sin cambios de frontend), acotada a RH: **T6 implementado** (captura `firmaArchivo` del actuante en cada transición del engine, incluida la omisión automática) y **T7 implementado** con Opción B (creación de SP: `firmaArchivo` del creador/ELABORA + `firmaSolicitanteArchivo` del solicitante/SOLICITA). La captura de creación de OC se adaptará en el futuro.

### Backend

- [x] **T1 — Cifrador**
  - `IFileCipher` + `AesFileCipher` (AES-256-GCM, envelope, streaming).
  - `ArchivosSettings:EncryptionKey`; valores en `appsettings.json` y `appsettings.Development.json`.
  - Verificación: `dotnet build` + round-trip manual (cifrar/descifrar).

- [x] **T2 — `ProfileService.UploadSignatureAsync`** — implementado en v2; ajustes v3 en T14
  - Guardar firma candidata en `PrivatePath/firmas/{userId}_{ts}.{ext}.enc` e INE en `PrivatePath/ine/{userId}_{ts}.{ext}.enc` (mismo timestamp).
  - Evento `remision` con nombres lógicos; eliminar lógica de carpeta `pendientes` y borrados.

- [x] **T3 — `FirmasService`** — implementado en v2; ajustes v3 en T15
  - Aprobar: actualizar el puntero; no borrar INE ni versión anterior; eventos iguales.
  - Rechazar: eliminar firma candidata + INE; evento `rechazo`.
  - `GetIneAsync`: descifrar; RH; última remisión; `?archivo=` validado (sin traversal, dentro de `ine/`).

- [x] **T4 — `FirmasController` + auditoría**
  - Endpoints de la sección 7; `[Authorize]`; wide-event de auditoría en cada acceso.

- [x] **T5 — Autorización por documento (SP/OC)**
  - Helper `PuedeVerSolicitudAsync(idSolicitud, idUsuario)` (regla del listado SP) y equivalente OC; mapeo `TipoEntidad` → validador para el endpoint de bitácora.

- [x] **T6 (Fase 2) — `WorkflowEngine` (captura de firma por acción)** — implementado
  - Al escribir la bitácora de transición (y la de omisión automática), se agrega `firmaArchivo` del usuario actuante (leído de `usuario_detalle.firma_path_cifrada`) al `datos_snapshot`. Punto único y transversal (aplica a cualquier módulo; no requiere tocar servicios de OC).
  - Verificación: firmar una solicitud y comprobar el campo en el historial.

- [x] **T7 (Fase 2) — Evento de creación (Solicitud Personal)** — implementado (Opción B: captura de creador y solicitante)
  - `SolicitudPersonalService` (~699): el snapshot de creación captura `firmaArchivo` (firma del **creador** en ese momento, cuadro ELABORA) y `firmaSolicitanteArchivo` (firma del **solicitante**, cuadro SOLICITA; cubre p. ej. incapacidades donde otra persona crea la solicitud).
  - **Pendiente futuro (OC):** cuando la versión nueva opere Órdenes de Compra (hoy se imprimen desde CXP), extender la captura a `OrdenCompraService` (~496) para el cuadro ELABORÓ de creación.
  - Verificación: crear solicitud y revisar snapshot.

- **T8 — Migración de firmas existentes — ELIMINADA (v3, decisiones 8 y 12)**
  - No se cifran ni mueven firmas legacy. El servicio `FirmaMigrationService` y su CLI se retiran del código (T17).

### Frontend

- [x] **T9 — Servicio y componente de blobs** — implementado como `services/firmas.service.ts` (`firmasEndpoints` + `fetchFirmaObjectUrl`) y `components/common/FirmaImg.tsx`
  - Se agregó `utils/waitForPrintImages.ts` para precarga/impresión.

- [x] **T10 — Perfil y RH**
  - `FirmaUploadCard`: preview propia vía `mi-firma` (blob); sin URL pública.
  - `FirmasUsuariosPage`: thumbnails vía endpoint; modal de comprobación con INE (ya blob) y firma por archivo.

- [x] **T11 — PDFs y OC** — implementado (`firmaEndpointDeUsuario` reemplaza a `firmaUsuarioUrl`); sin referencias a `/media/archivos/firmas_usuarios` en el frontend
  - `SolicitudPersonalPDF` (`buildFirmasMap` prefiere `datosSnapshot.firmaArchivo` → endpoint bitácora; fallback firma vigente), `VacacionesPDF`, `GoceDeSueldoPDF`, `IncapacidadPDF`, `IncidenciaPDF`, `AutorizacionesOC`, `EnvioConcentrado`.
  - **Precarga de blobs**: esperar la carga antes de imprimir/exportar.

### Documentación

- [x] **T12 —** Este documento es la referencia de ejecución; el plan anterior queda como registro histórico. Actualizado a v3 (convivencia CXP, sin migración).

### Ajustes v3 (implementados)

- [x] **T13 — Columna `firma_path_cifrada`** — script creado; pendiente de ejecución por el usuario en `Lefarma` y `LefarmaDev`
  - Script `036_alter_usuario_detalle_firma_path_cifrada.sql` (idempotente, estilo 027): `firma_path_cifrada NVARCHAR(500) NULL`.
  - **Debe aplicarse antes de desplegar** (EF selecciona la columna al leer `UsuarioDetalle`).
  - `UsuarioDetalle.FirmaPathCifrada` + mapeo en `UsuarioDetalleConfiguration`.

- [x] **T14 — `ProfileService` a la columna cifrada**
  - `HasFirmaAsync` → `FirmaPathCifrada`.
  - `UploadSignatureAsync`: `subidasEfectivas = cifrada vacía ? 0 : Math.Max(control.Subidas, 1)` (ignora el backfill 027; el legacy queda libre sin gate especial).
  - `DeleteSignatureAsync`: anula solo `FirmaPathCifrada` (no toca `firma_path` ni el archivo público; conserva el `.enc`).
  - `SolicitarCambioFirmaAsync` y `GetProfileAsync` (`FirmaSubidas` con la misma regla; exponer `FirmaPathCifrada` en la respuesta).

- [x] **T15 — `FirmasService`: presencia desde cifrada y servido estricto**
  - `GetUsuariosConFirmaAsync`: filtro/thumbnail/`FirmaSubidas` desde cifrada.
  - `HabilitarCambioFirmaAsync`: gate desde cifrada.
  - `AprobarFirmaAsync`: setea `FirmaPathCifrada` y nada más (sin copia pública, sin tocar `firma_path`).
  - `GetFirmaVigenteAsync`: solo `FirmaPathCifrada`; eliminar el fallback a `FirmaPath` y a `{userId}_*`.
  - Limpiar ramas legacy muertas de `ServirFirmaAsync`, `EliminarFirmaCandidata`, `EliminarIne`, `ExisteIne` y del INE legacy.
  - Nuevo `GetFirmaSolicitanteAsync` + endpoint `solicitud-personal/{id}/solicitante`: firma del solicitante para el cuadro SOLICITA cuando otra persona crea la solicitud (autorizado a quien ve la solicitud); prefiere la captura `firmaSolicitanteArchivo` del snapshot de creación.

- [x] **T16 — Frontend (campo cifrado)**
  - `ProfileResponse` (backend DTO) + `authStore` (`hasFirma`) + `FirmaUploadCard` (preview) + `types/usuario.types.ts` → `firmaPathCifrada`.
  - `FirmasUsuariosPage` sin cambios (el listing del backend ya devuelve el valor cifrado).
  - Impresión: cuadro SOLICITA usa la firma del solicitante (endpoint nuevo) y overlay "Preparando documento…" mientras cargan los blobs (`SolicitudesPersonal` y `GestionSolicitudes`).

- [x] **T17 — Retirar la migración del código**
  - Eliminar `Features/Firmas/FirmaMigrationService.cs`, su registro DI y el bloque CLI `migrar-firmas` de `Program.cs` (evita el footgun de escribir `firma_path`).

- [ ] **T18 — Datos (prod y dev)** — scripts creados; pendientes de ejecución por el usuario
  - Script `037_limpiar_firma_control.sql`: `SET firma_control = NULL, firma_path_cifrada = NULL` (Lefarma y LefarmaDev) — todos se tratan como nuevos; limpia además punteros de prueba que apunten a archivos locales.
  - Dev: restaurar `firma_path` de las 15 filas migradas a `firmas_usuarios/{id}.png` (para parearnos a producción).

- [x] **T19 — Verificación** — builds OK; pruebas manuales pendientes
  - `dotnet build` (0 errores) + `npm run build` OK.

### Verificación final

- [x] `dotnet build` (0 errores) y `npm run build` OK (base v2 + ajustes v3).
- [ ] Pruebas manuales v3 **(requieren backend + BD en ejecución)**:
  1. Legacy = nuevo: `hasFirma = false`; puede remitir sin habilitación; tras aprobar, `firma_path_cifrada` seteada y `firma_path` intacto.
  2. Remisión: archivos cifrados en carpetas privadas; nada accesible por `/media/archivos` del sistema RH.
  3. Aprobar: firma vigente activa, **INE conservada**, versión anterior conservada; usuario notificado.
  4. Rechazar: firma candidata e INE **eliminadas**; evento con motivo; usuario notificado.
  5. Servido estricto: sin firma cifrada → 404 en `mi-firma` y `usuarios/{id}/firma`; INE sin permiso RH → 403; INE tras rechazo → 404.
  6. Eliminar firma (con habilitación): `firma_path_cifrada` nula, `.enc` conservado, `firma_path`/carpeta pública intactos.
  7. Convivencia CXP: Perfil y OC de CXP siguen viendo `firmas_usuarios/{id}.png`; `firma_path` sin cambios.
  8. `firma_control` limpio: nadie aparece con historial previo; listado RH sin ruido.
  9. Auditoría: wide-events de accesos a INE/firmas consultables en `logs/wide-events-*.json`.
  10. Impresión: solicitud creada por otra persona a nombre del empleado → cuadro SOLICITA con la firma del empleado (capturada al crear la solicitud si existe; si no, la vigente — los históricos no tienen captura); el creador queda como ELABORA. Overlay "Preparando documento…" visible hasta que abre el diálogo de impresión.
  11. Fase 2 (T6): tras firmar una transición, el snapshot del evento trae `firmaArchivo`; cambiar la firma del usuario y reimprimir → se muestra la firma capturada en el evento (no la nueva).

---

## 9. Fuera de alcance

- Migración de firmas legacy (eliminada por decisiones 8 y 12).
- Limpieza de la carpeta pública `firmas_usuarios` (es de CXP; se retirará al juntar las versiones).
- Captura de firma por evento en Órdenes de Compra (T7-OC): se adaptará en el futuro, cuando la versión nueva opere OC en producción (hoy se imprimen desde CXP).
- Tabla relacional `firma_versiones`/`firma_eventos` (disparador futuro: reportería estructurada; el JSON es append-only y apto para migrar).
- Depuración automática por antigüedad (plazo de retención por definir con normas).
- Hashes de firma/INE.
- Cifrado de otros archivos del módulo Archivos.
- Bloqueo de `CERRAR` en Órdenes de Compra (fuera de alcance desde el plan original).

---

## 10. Notas y riesgos

- **Clave de cifrado:** su pérdida implica pérdida de evidencia; respaldarla y documentar rotación.
- **Convivencia con CXP:** `firma_path` y la carpeta pública no se tocan desde el sistema RH; sin copia dual. Las firmas legacy siguen públicas (CXP). Al juntar las versiones, quienes usaron RH ya tendrán su firma cifrada; el resto subirá en ese momento.
- **`HasFirma` global:** afecta a RH, Educación Médica y Órdenes de Compra de la versión nueva: todo firmante debe validar su firma en RH.
- **Sin migración:** no existe versión cifrada de las firmas históricas; no se necesita, la validación se hace con INE.
- **PDFs ya almacenados en Asokam:** llevan las firmas embebidas como bytes; no se afectan por el cambio.
- **`AdminService`** escribe `FirmaPath` directo (contrato CXP).
- **Eventos rechazados:** quedan en el JSON con motivo/fecha, pero sus nombres de archivo apuntan a archivos eliminados; es registro del proceso, no evidencia.
- **Sin tests automatizados** (preferencia del usuario); verificación por builds + pruebas manuales.
