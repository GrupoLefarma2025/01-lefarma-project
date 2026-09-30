# Plan: Validación de firma con INE y estado "En comprobación"

**Fecha:** 2026-09-29
**Estado:** Pendiente de aprobación

---

## 1. Objetivo

Al subir o cambiar la firma digital, el usuario deberá adjuntar una foto de su INE. RH revisa ambas imágenes (comparación firma vs INE) y aprueba o rechaza. Mientras la firma esté **En comprobación**, el usuario no podrá ejecutar la acción **CERRAR** en Solicitudes Personales.

---

## 2. Decisiones acordadas

| # | Tema | Decisión |
|---|------|----------|
| 1 | Alcance | La validación con INE aplica a **primera firma y cambios** |
| 2 | Flujos existentes | Se **mantienen** solicitud/habilitación de cambio. La habilitación se consume al **remitir** a revisión |
| 3 | Bloqueo de CERRAR | Solo en **Solicitudes Personales** (OC no se bloquea) |
| 4 | Rechazo | **Con motivo** + notificación al usuario (in-app + correo) |
| 5 | Foto de INE | Se **borra físicamente** al resolver (aprobación o rechazo) |
| 6 | Almacenamiento INE | **Carpeta privada + endpoint autenticado** (no módulo Archivos, no base64) |

---

## 3. Contexto verificado

- `HasFirmaAsync` solo verifica que `firma_path` exista; se usa en crear/editar/firmar solicitudes personales, enviar al director, OC y educación médica.
- La acción **CERRAR** es una acción del workflow ejecutada en `SolicitudPersonalFirmasService.FirmarAsync` (vía `request.IdAccion` → `codigoAccionSolicitada`) y en `OrdenCompraFirmasService` (fuera de alcance).
- Los botones de acciones de SP se pintan en `apps/rh/components/SolicitudFirmaTab.tsx`; las acciones vienen de `WorkflowQueryService.GetAccionesDisponiblesAsync`.
- `/api/media/archivos` y `/media/archivos` mapean `ArchivosSettings:BasePath` (dev: `C:\archivos`) como **estático sin autenticación** (`Program.cs:509-532`), y `wwwroot` se sirve público con `app.UseStaticFiles()` (`Program.cs:485`).
- El módulo Archivos **solo hace soft-delete**: `Activo=false` + renombra a `*_inactivo.ext`, nunca borra el físico (`ArchivoService.cs:203-224`, `ArchivoRepository.cs:62-71`). No sirve para la INE.
- La firma se gestiona con I/O directo a disco en `ProfileService` (`UploadSignatureAsync` línea 272, `DeleteSignatureAsync` línea 330), sin pasar por el módulo Archivos.
- **Bug preexistente:** el borrado de la firma anterior usa `_env.WebRootPath + FirmaPath` (`ProfileService.cs:294,347`), pero la firma se guarda bajo `ArchivosSettings:BasePath` (`ProfileService.cs:300`). Hoy nunca se borra la firma anterior (quedan huérfanas). Se corrige en este trabajo porque la aprobación reemplaza la firma.
- El estado de firma vive en el JSON `firma_control` de `UsuarioDetalle` (`Domain/Firmas/FirmaControl.cs`, `FirmaEvento.cs`, `FirmaCambioPolicy.cs`). **Sin scripts SQL.**
- Precedente de imagen autenticada en frontend: `FileViewer.tsx:154` (`API.get(..., { responseType: 'blob' })` + `URL.createObjectURL`).
- Permiso reutilizado: `usuarios.firma.habilitar_cambio` para listar pendientes, aprobar, rechazar y ver INE.

---

## 4. Modelo de datos (JSON `firma_control`, sin columnas nuevas)

### 4.1 Eventos nuevos

| Acción | Campos adicionales | Descripción |
|--------|--------------------|-------------|
| `remision` | `firmaPendiente` (ruta relativa), `ine` (nombre físico) | Usuario envía firma + INE a revisión de RH |
| `aprobacion` | — | RH aprueba; la firma pendiente pasa a ser la vigente |
| `rechazo` | `motivo` | RH rechaza con motivo |

`FirmaEvento` gana campos opcionales; serializar omitiendo `null` (`JsonIgnoreCondition.WhenWritingNull`) para no ensuciar el JSON existente.

### 4.2 Estados derivados en `FirmaControl`

- `EnComprobacion`: el último evento entre `{remision, aprobacion, rechazo}` es `remision`.
- `CambioHabilitado` (existente, ajustado): el último evento entre `{subida, eliminacion, habilitacion, remision}` es `habilitacion`. Así **remitir consume la habilitación**; si RH rechaza un cambio, se requiere nueva habilitación.
- `PuedeEnviarRemision(subidasEfectivas)`: `!EnComprobacion && (subidasEfectivas == 0 || CambioHabilitado)`.
  - `subidasEfectivas = Math.Max(control.Subidas, FirmaPath == null ? 0 : 1)` (misma fórmula actual).
- Al **aprobar** se agrega también el evento `subida` (mantiene el conteo y el bloqueo vigente).
- `SolicitudPendiente` (existente) no cambia.

---

## 5. Almacenamiento

| Archivo | Ubicación | Ciclo de vida |
|---------|-----------|---------------|
| Firma pendiente | `{BasePath}/firmas_usuarios/pendientes/{userId}_{yyyyMMddHHmmss}.{ext}` | Se mueve a `{BasePath}/firmas_usuarios/{userId}.{ext}` al aprobar; se borra al rechazar |
| Firma vigente | `{BasePath}/firmas_usuarios/{userId}.{ext}` | Se borra al aprobar una nueva (corrigiendo el bug de ruta) |
| Foto INE | `{PrivatePath}/ine_usuarios/{userId}_{yyyyMMddHHmmss}.{ext}` | Se borra siempre al resolver (aprobación o rechazo) |

- Nueva config `ArchivosSettings:PrivatePath`:
  - `appsettings.json`: `private-media` (relativo al content root, **fuera** de `wwwroot` y de `BasePath`).
  - `appsettings.Development.json`: `C:\archivos_privados`.
- La carpeta privada **no** se mapea como estático: la INE solo se sirve por endpoint autenticado.
- Borrado físico real con `File.Delete` (no soft-delete).

---

## 6. Flujo

1. **Usuario** (primera firma o cambio habilitado): sube/dibuja firma + **foto de INE obligatoria** → confirma → `POST /api/profile/firma` (multipart `file` + `ine`).
2. **Backend**: valida, guarda firma pendiente e INE, agrega evento `remision` (consume habilitación), **no toca `firma_path`**, notifica a usuarios RH con permiso.
3. **RH**: ve la bandeja "En comprobación" con comparación lado a lado (firma pendiente vs INE) → Aprobar o Rechazar (con motivo).
4. **Aprobar**: mueve pendiente → firma vigente, borra firma anterior e INE, agrega eventos `aprobacion` + `subida`, notifica al usuario.
5. **Rechazar**: borra pendiente e INE, agrega `rechazo` con motivo, notifica al usuario (in-app + correo).
6. **Mientras EnComprobacion**: `CERRAR` bloqueado en Solicitudes Personales (backend + botón deshabilitado en frontend).

---

## 7. Tareas de implementación

### Backend

- [ ] **T1 — `Domain/Firmas/FirmaEvento.cs` y `FirmaControl.cs`**
  - Campos opcionales nuevos: `FirmaPendiente`, `Ine`, `Motivo`.
  - Acciones nuevas: `remision`, `aprobacion`, `rechazo` (+ métodos `AgregarRemision`, `AgregarAprobacion`, `AgregarRechazo`).
  - Derivados: `EnComprobacion`, `PuedeEnviarRemision`; ajuste de `CambioHabilitado` para incluir `remision`.
  - Verificación: `dotnet build` + revisar que el parseo de JSON existente (sin campos nuevos) siga funcionando.

- [ ] **T2 — `ArchivosSettings` (`Features/Archivos/Settings/ArchivosSettings.cs`) + appsettings**
  - Nueva propiedad `PrivatePath`.
  - `appsettings.json`: `private-media`; `appsettings.Development.json`: `C:\archivos_privados`.

- [ ] **T3 — `Features/Profile/ProfileService.cs` / `IProfileService.cs` / `ProfileController.cs`**
  - `UploadSignatureAsync`: acepta `ine` (IFormFile) obligatoria; valida firma (png/jpg/jpeg ≤2 MB, igual que hoy) e INE (png/jpg/jpeg ≤5 MB); valida `PuedeEnviarRemision`; si `EnComprobacion` → error "Ya tienes una firma en comprobación por Recursos Humanos".
  - Guarda firma pendiente e INE en sus carpetas; agrega `remision`; **no** modifica `FirmaPath`.
  - Corrige resolución de rutas de borrado (`File.Delete`) usando `ArchivosSettings:BasePath` en lugar de `_env.WebRootPath` (líneas 294 y 347).
  - `DeleteSignatureAsync`: bloquear si `EnComprobacion`.
  - Notificación a RH al remitir (reutilizar patrón de `NotificarSolicitudRhAsync`).
  - `GetProfileAsync`/DTO: exponer `firmaEnComprobacion`.
  - Nuevo `TieneFirmaEnComprobacionAsync(userId)` en `IProfileService`.
  - Verificación: `dotnet build`; subir firma+INE sin ser primera vez ni estar habilitado → error.

- [ ] **T4 — `Features/Firmas/` (`FirmasService`, `IFirmasService`, `FirmasController`, `DTOs/FirmasDTOs.cs`)**
  - Listado: incluir usuarios con firma o con historial (`FirmaPath != null || FirmaControlJson != null`) para que aparezcan los pendientes de primera vez; respuesta con `EnComprobacion`, `FechaRemision`, `TieneIne`, ruta pública de la firma pendiente.
  - `POST /api/firmas/usuarios/{id}/aprobar` (permiso `usuarios.firma.habilitar_cambio`): valida `EnComprobacion`; mueve pendiente → `{userId}.{ext}`; borra firma anterior (ruta correcta) e INE; eventos `aprobacion` + `subida`; notifica al usuario.
  - `POST /api/firmas/usuarios/{id}/rechazar` con `{ motivo }`: valida `EnComprobacion`; borra pendiente e INE; evento `rechazo` con motivo; notifica al usuario.
  - `GET /api/firmas/usuarios/{id}/ine` (mismo permiso): devuelve la imagen solo si `EnComprobacion` y el archivo existe; `NotFound` si ya fue borrada.
  - Verificación: probar aprobar/rechazar dos veces (segunda debe fallar) y descarga de INE sin permiso → 403.

- [ ] **T5 — Bloqueo de CERRAR en SP**
  - `Features/Rh/SolicitudesPersonal/Firmas/SolicitudPersonalFirmasService.cs`: en `FirmarAsync`, si `codigoAccionSolicitada == "CERRAR"` y `TieneFirmaEnComprobacionAsync(userId)` → `Validation` con mensaje claro.
  - No tocar `OrdenCompraFirmasService` (fuera de alcance).
  - Verificación: `dotnet build` + prueba manual de cierre durante pendiente.

### Frontend

- [ ] **T6 — `src/components/common/FirmaUploadCard.tsx`**
  - Confirmación con selector de **INE obligatorio** (preview + validación de tipo/tamaño).
  - Enviar multipart `file` + `ine` en `ProfileService.UploadSignatureAsync` (actualizar el servicio de `src/services/`).
  - Banner "Tu firma está en comprobación" y botones de firma bloqueados mientras `firmaEnComprobacion`.

- [ ] **T7 — `src/apps/rh/pages/FirmasUsuariosPage.tsx`**
  - Filtro/sección "En comprobación" con fecha de remisión.
  - Modal de comparación: firma pendiente vs INE (INE por blob con `API.get(..., { responseType: 'blob' })`, precedente `FileViewer.tsx`).
  - Botones Aprobar / Rechazar (motivo obligatorio) con confirmación y refresco del listado.

- [ ] **T8 — `src/apps/rh/components/SolicitudFirmaTab.tsx`**
  - Deshabilitar el botón `CERRAR` con aviso cuando `firmaEnComprobacion` (el backend igual lo bloquea).

- [ ] **T9 — Tipos e historial**
  - Tipos de perfil/firmas (`usuario.types.ts`, tipos de firmas) con `firmaEnComprobacion`, `enComprobacion`, `fechaRemision`, `tieneIne`.
  - Etiquetas nuevas de historial: `remision`, `aprobacion`, `rechazo` (incl. motivo).

### Verificación final

- [ ] `dotnet build` (backend) y `npm run build` / `tsc --noEmit` (frontend).
- [ ] Pruebas manuales:
  1. Primera firma con INE → queda "En comprobación"; RH notificado.
  2. RH aprueba → firma activa, INE borrada, usuario notificado.
  3. Cambio: solicitar → RH habilita → remitir (consume habilitación) → RH rechaza con motivo → se requiere nueva habilitación; INE borrada.
  4. CERRAR en SP bloqueado durante pendiente (backend + botón); OC sin cambios.
  5. La INE no es accesible por `/api/media/archivos` ni `/media/archivos`; el endpoint devuelve 403 sin permiso.
  6. Historial de usuario y RH muestra los eventos nuevos con etiqueta correcta.

---

## 8. Fuera de alcance

- Bloqueo de CERRAR en Órdenes de Compra.
- Auditoría/retención de la foto de INE (se borra al resolver, decisión explícita).
- Cambios al borrado del módulo Archivos (sigue siendo soft-delete).
- Scripts SQL (todo el estado vive en el JSON `firma_control` existente).

## 9. Notas y riesgos

- La habilitación se consume al **remitir**; si se prefiere consumirla al **aprobar**, el cambio es puntual en `FirmaControl` (T1).
- En dev, `BasePath` es `C:\archivos` (público completo): la carpeta privada **debe** quedar fuera (`C:\archivos_privados`).
- La corrección del borrado de firma anterior puede dejar huérfanos existentes en disco (preexistentes); no se limpian en este trabajo salvo que se pida.
- Sin tests automatizados por el momento (preferencia del usuario); verificación por build + pruebas manuales.
