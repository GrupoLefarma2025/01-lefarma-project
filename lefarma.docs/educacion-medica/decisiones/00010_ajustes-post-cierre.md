---
fecha_creacion: 2026-10-09 19:15
fecha_modificacion: 2026-10-10 17:00
resumen: Ajustes post-cierre de Educación Médica — cambios puntuales (fecha, hora y logística) sobre documentos ya cerrados (rutas `Cerrada`, talleres `Autorizado`/`Programado`) sin re-ejecutar el flujo: permiso exclusivo del Coordinador de Educación Médica, motivo obligatorio y bitácora `ajustes_post_cierre` con valores antes/después. Incluye la solicitud de cambio del equipo (`taller_solicitudes_cambio`, contenido en JSON) resuelta por el CEM desde la Matriz General, el límite configurable de 45 días y la sincronización taller → ruta. No sustituye a "Solicitar cambio": los cambios estructurales siguen cancelando, regenerando y volviendo a firmar. Scripts 0027 y 0029.
---

# 00010 — Ajustes post-cierre (fecha, hora y logística)

## Status

Accepted

> **Aprobado (2026-10-10).** Implementación (scripts 0027/0029 + backend + frontend), pruebas unitarias y verificación E2E completas (incluye límite de 45 días, sincronización taller→ruta, solicitudes y notificaciones); documentación y diagramas sincronizados.
>
> **Plan para revisión del usuario.** Este ADR materializa el "ADR futuro" que anticipó ADR-00004 (decisión 12: *"Cambio post-confirmación: no se edita una ruta confirmada; … Una pantalla de 'solicitud de modificación' formal queda como ADR futuro"* — referencia interna). Complementa a ADR-00006 (workflow), ADR-00007 (matriz) y ADR-00008 (impartición) **sin modificar sus flujos**: agrega una vía lateral, auditada y con permiso, para imprevistos operativos.

> **Decisiones del usuario (2026-10-09):**
> - Ajustes **sin firma digital**: motivo obligatorio + auditoría (usuario, fecha, valores antes/después).
> - Permisos nuevos **exclusivos del Coordinador de Educación Médica (CEM)**; el SuperAdministrador hereda por re-grant.
> - El ajuste del taller se permite en **`Autorizado` y `Programado`**; `EnCurso`/`Realizado` quedan cerrados.
> - **Sin flujo de autorización mientras la captura está abierta** (2.ª ronda 2026-10-09; refinado en la 3.ª ronda): un cambio de hora/fecha no pasa por bandeja de aprobaciones cuando el documento aún es editable; el CEM aplica directo con permiso + motivo + auditoría. Para el caso **bloqueado/fuera de captura** aplica la solicitud del equipo (3.ª ronda) — la tabla de historial ya cubre la transparencia en ambos caminos.
> - **Límite temporal**: `dias_limite_cambio` (default **45**, configurable en Parámetros) validado en backend desde la fecha original del taller/visita.
> - **Sincronización taller → ruta**: al ajustar la fecha de un taller se mueve la visita de la ruta activa en la misma transacción, revalidando capacidad.
> - **`es_bloqueado` se mantiene sin cambios** (ADR-00007); el ajuste post-cierre no lo necesita ni lo retira.
> - **Solicitud de cambio del equipo** (3.ª ronda 2026-10-09): con el candado puesto o la matriz ya enviada/cerrada, el equipo **no adivina**: ve el candado y el botón contextual "Solicitar cambio" → se crea `taller_solicitudes_cambio` (`Pendiente`) con el cambio en `datos_json`. El CEM autoriza o rechaza; el **ajuste directo del CEM se conserva** como vía rápida. Ambos caminos escriben el mismo historial.
> - **Resolución en la Matriz General, sin bandeja nueva**: los talleres con solicitud pendiente se ordenan **arriba con icono**; el CEM resuelve ahí mismo. La Matriz General es el panorama de cómo van los equipos y talleres (visión tipo "agencia": cada taller como una solicitud con su estatus).
> - **Contenido en JSON**: la solicitud guarda columnas mínimas (`id_solicitud`, `id_taller`, `estado` — ciclo de la solicitud — y auditoría); el cambio (valores antes/después, motivos, actores) va en `datos_json`. El orden/destacado en la Matriz **no consulta la tabla**: el DTO del taller expone `solicitudCambioPendiente` (id, diff, solicitante, fecha) calculado por join.
> - **Notificación in-app (campana) + correo** al CEM al crear la solicitud y al solicitante al resolverse, con el servicio de notificaciones existente (`INotificationService`: canales in-app/SSE y email SMTP; precedentes `IncidenciasChecadoNotificacionService` y `EmailNotificationChannel`).

> **Revisión 2026-10-10 (temporal).** Por decisión del usuario, el **canal de correo queda deshabilitado temporalmente** en las notificaciones de solicitudes de cambio de talleres (creación → CEM y resolución → solicitante): **solo in-app**. El código del canal email se conserva comentado en `TalleresService` para reactivarlo después.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Estados y candados (contexto)|Estados y candados (contexto)]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño (el porqué de cada una)|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos (script 0027)|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
  - [[#Fase 4 — Verificación y cierre|Fase 4 — Verificación y cierre]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

1. **Ajuste ≠ reapertura.** El documento conserva su estado (`Cerrada`/`Autorizado`) y sus firmas; cada cambio puntual exige **motivo** y se registra en `educacion_medica.ajustes_post_cierre` (usuario, fecha, acción y valores antes/después). Sin firma digital (decisión del usuario 2026-10-09).
2. **Alcance en rutas (versión `Cerrada`)**: mover visita (fecha/orden), editar `hora_salida`/`hora_llegada`, alta y baja de visita. La alta de hospital fuera de la selección es la visita extraordinaria (ADR-00011).
3. **Alcance en talleres (`Autorizado`/`Programado`)**: fecha, hora, lugar y número de participantes. `EnCurso`/`Realizado` no se ajustan (ADR-00008 gobierna ese ciclo). Con la revisión 2026-10-09 del ADR-00008 el cierre de matriz escribe `Programado`; `Autorizado` se conserva por si se revierte el disparador.
4. **Permisos**: `educacion_medica.rutas.puede_ajustar` y `educacion_medica.talleres.puede_ajustar`, exclusivos del CEM. Los permisos normales (`gestionar`/`capturar`) **no** habilitan ajustes.
5. **Capacidad**: los topes de 3 visitas/día, 8/semana y viajes foráneos se calculan y **avisan**, pero no bloquean el ajuste. *(Supuesto a validar en esta revisión.)*
6. **"Solicitar cambio" no desaparece**: cambios estructurales (otro equipo/región, otra versión, recálculo de propuesta) siguen el flujo cancelar → regenerar → volver a firmar.
7. **Efectos en cascada**: asignaciones, calendario, impresión y el pool de captura de talleres leen rutas `Cerrada`; el ajuste se refleja de inmediato sin re-publicación manual.
8. **La cancelación de versión se audita**: `CancelarAsync` (endpoint de "Solicitar cambio") **no ejecuta el motor**: escribe `Cancelada` directo y hoy el motivo solo queda en logs. Se agrega el registro `CANCELAR_VERSION` en `ajustes_post_cierre` (entidad `RUTA_VERSION`) para **persistir el motivo**, sin cambiar el bypass ni el comportamiento.
9. **Sin candados nuevos**: el estado final (`Cerrada`/`Programado`) + el permiso del CEM bastan; no se agregan flags tipo `es_bloqueado` a rutas/talleres (decisión del usuario 2026-10-09). El único candado de captura existente (`matrices_individuales.es_bloqueado`) permanece como está.
10. **Ajustes pequeños directos cuando la captura está abierta**: mientras el candado está abierto (matriz en captura), el cambio de hora/fecha/logística se aplica directo (equipo con captura, CEM con ajuste) con motivo + auditoría y **sin aprobación**. La **solicitud de cambio** del ADR (decisión 13) es el canal cuando el documento ya está bloqueado o fuera de captura; los cambios estructurales siguen el flujo "Solicitar cambio" (versión).
11. **Límite temporal**: el backend rechaza el ajuste si la fecha original del taller/visita supera `dias_limite_cambio` días (parámetro de `parametros_modulo`, default **45**, editable en Parámetros) — evita corregir talleres de meses atrás.
12. **Sincronización taller → ruta**: al ajustar la fecha de un taller, la visita de la ruta activa (misma `id_seleccion_hospital`; si es extraordinaria, por `id_hospital` + `es_extraordinaria`) se mueve a la nueva fecha **en la misma transacción**, revalidando 3/día y 8/semana; si no cabe, el ajuste se rechaza con aviso.
13. **Solicitud de cambio del equipo** (`taller_solicitudes_cambio`): canal del equipo cuando el candado está puesto o la matriz salió de captura. Estados `Pendiente/Aprobada/Rechazada/Cancelada`; la crea cualquier integrante del equipo (o el CEM con captura asistida) con el cambio en `datos_json`; **el CEM la resuelve** desde la Matriz General. Al aprobar se aplica con la misma lógica del ajuste (sincronización de ruta, límite de 45 días, `ajustes_post_cierre`); al rechazar solo se registra el motivo.
14. **Resolución en la Matriz General, sin bandeja nueva**: el listado de Matriz General ordena **arriba** los talleres con solicitud pendiente y los marca con icono; ahí mismo el CEM autoriza/rechaza. La pantalla concentra el panorama de equipos y talleres (estado por taller, avance por equipo).
15. **Columnas mínimas + JSON**: `id_solicitud`, `id_taller`, `estado` (ciclo de la solicitud: `Pendiente/Aprobada/Rechazada/Cancelada`), `datos_json` (diff antes/después, motivos y actores) y auditoría estándar. **El orden/destacado no se resuelve consultando la tabla**: el DTO del taller incluye `solicitudCambioPendiente` (id, diff, solicitante, fecha) vía join, y la Matriz ordena y pinta con ese campo. Notificación al CEM al crear y al solicitante al resolver, por **in-app (campana/SSE) y correo**.

## Estados y candados (contexto)

Aclaración verificada en código (2026-10-09) para evitar confusiones entre el workflow y los estados de operación:

| Documento | Entidad del workflow | Estado propio | Candado |
|---|---|---|---|
| **Selección** | `selecciones_mensuales` | `estado` de dominio **sincronizado** del motor (`Creada/EnRevision/Cerrada/Rechazada/Cancelada`) | Estados finales; sin flag |
| **Rutas** | `rutas_versiones` | `rutas_versiones.estado` + `rutas.estado` sincronizados (`Creada/Cerrada/Rechazada/Cancelada/Archivada`) | `Cerrada` es el candado; los ajustes se abren por **permiso** (este ADR) |
| **Matriz** | `matrices_generales` (la entidad declara: *"No tiene estado propio: su estado es el del motor"*) | Solo `matrices_individuales.es_bloqueado` (ventana de captura) | `es_bloqueado` en la individual |
| **Taller** | **Ninguna** — el taller no es entidad del motor | `talleres.estado` propio (`Creada→…→Programado→EnCurso→Realizado/Cancelado`), validado en servicio (ADR-00008) | Su propio estado; transiciones permitidas |

- **"Programado/EnCurso/Realizado" no son workflow**: el ADR-00008 (revisión 2026-10-09) decide que la impartición es ejecución, no autorización; el cierre de la matriz escribe `Programado` automático y cada transición se registra en `taller_estados_historial`.
- **"Solicitar cambio" no toca el workflow** (`RutasService.CancelarAsync`, líneas 514-539): es un bypass deliberado para el cambio post-confirmación; este ADR solo le agrega auditoría del motivo.
- **La visita extraordinaria no tiene estado propio** (ADR-00011): gobierna la ruta; cancelar una visita es un ajuste (`BAJA_VISITA`), no una transición.
- **¿Cómo sabe el equipo cuándo editar?** El candado es visible en "Mis talleres": con **candado abierto** (matriz en captura) se edita directo; con **candado puesto o matriz enviada/cerrada** el botón cambia a **"Solicitar cambio"** y se muestra el estado de la solicitud. No hay que "adivinar el desbloqueo": el GV puede reabrir mientras la general esté en `Creada` (corrección rápida) y la solicitud cubre el resto.
- **¿Qué es "post-cierre / urgencia"?** *Post-cierre* = el documento ya alcanzó su estado final (taller `Autorizado`/`Programado`, versión de rutas `Cerrada`); *urgencia* = el CEM aplica el ajuste **directo** sin esperar la solicitud o aprobación del equipo (vía rápida del ADR, con motivo y auditoría). La solicitud del equipo es el canal normal cuando el candado está puesto; el ajuste directo del CEM es la excepción operativa — **no un cuarto estado**.

## Fases

### Fase 0 — Decisiones de diseño (el porqué de cada una)

1. **Ajuste lateral en vez de reabrir el workflow**
   *Por qué:* el motor existe para **autorizar** documentos (GV→AEM→CA→DC); un cambio de fecha o de hora no cambia la autorización. Reabrir el flujo por cada imprevisto repetiría firmas de cuatro roles, frenaría la operación y desincentivaría corregir (el error se "dejaría pasar"). La vía lateral mantiene la autorización y deja **traza explícita** del cambio.
2. **Auditoría en tabla propia (`ajustes_post_cierre`), no en la bitácora del motor**
   *Por qué:* `config.workflow_bitacora` registra **acciones del workflow** (transiciones); un ajuste no es una transición de estado y ensuciaría el historial del documento. Una tabla dedicada permite consultar "¿qué se movió, cuándo y por qué?" sin tocar el vocabulario del motor. El principio *"quién firma no edita"* del ADR-00006 se conserva: el ajuste queda **atribuido** a un usuario con permiso específico.
3. **Permisos dedicados (no reutilizar `gestionar`/`capturar`)**
   *Por qué:* menor privilegio. Quien captura rutas (CEM/AEM/GV) no necesariamente debe poder alterar un documento ya publicado; el permiso de ajuste se otorga explícitamente y es auditable en el admin de permisos (patrón ADR-00009: candado real en backend, guard de UX en frontend).
4. **Sin firma digital**
   *Por qué:* decisión del usuario. La fricción mínima es la razón de ser del mecanismo; la garantía recae en motivo obligatorio + auditoría completa + permiso exclusivo. Ajustable en el futuro configurando el mecanismo como acción del motor si negocio lo pide.
5. **Capacidad: avisar, no bloquear**
   *Por qué:* bloquear forzaría a cancelar y regenerar la versión (justo el flujo pesado que este ADR evita) cuando el imprevisto ya ocurrió; el aviso visible + motivo documentan la excepción. **Supuesto a validar:** si negocio prefiere candado duro, basta cambiar la validación de aviso a error en el servicio.
6. **Alcance acotado por estado**
   *Por qué:* antes del cierre los documentos ya son editables con sus flujos normales (`Creada`); después de `EnCurso`/`Realizado` manda la ejecución y su evidencia (ADR-00008), donde ya existe Cancelar con motivo. El ajuste cubre solo la ventana "documento publicado, operación en curso".
7. **Valores antes/después en JSON (`NVARCHAR(MAX)`)**
   *Por qué:* los campos ajustables son heterogéneos (fecha, orden, horas, participantes); un JSON legible evita columnas por campo y permite crecer sin migrar esquema. La consulta típica es por entidad, cubierta por índice.
8. **Sin flujo de autorización para lo pequeño** (2.ª ronda 2026-10-09)
   *Por qué:* un cambio de hora no justifica construir una bandeja de aprobaciones; la fricción haría que los cambios no se registren y se "arreglen" fuera del sistema. La garantía es permiso exclusivo + motivo + auditoría. La solicitud con aprobación (patrón proveedores) se descarta para v1; si negocio la pide, se agrega como tabla de solicitudes sin tocar este modelo.
9. **Límite temporal configurable**
   *Por qué:* corregir un taller que ocurrió hace meses distorsiona indicadores y rankings (cobertura lee `Realizado`); el parámetro permite endurecer o relajar el plazo sin recompilar y hace visible el porqué en la pantalla de Parámetros.
10. **Sincronización taller → ruta**
    *Por qué:* la ruta impresa y las asignaciones del equipo deben reflejar la nueva fecha; mantenerlas divergentes rompe la confianza en el calendario. La revalidación de capacidad conserva las reglas del negocio y el rechazo explícito evita sobrecupos silenciosos.
11. **Solicitud del equipo como canal del candado** (3.ª ronda 2026-10-09)
    *Por qué:* con el documento enviado/cerrado el equipo no puede editar; la solicitud da un camino claro, notificado y auditado sin obligarlo a pedirlo por fuera, y mantiene el candado intacto (ADR-00007) sin necesidad de "adivinar" cuándo se desbloquea.
12. **Resolver donde vive el panorama (Matriz General)**
    *Por qué:* el CEM/GV ya trabajan en la Matriz General para ver el avance de equipos y talleres; una bandeja nueva duplicaría superficies. Pendientes **arriba + icono** convierten la matriz en la mesa de control (visión de agencia: cada taller con su estatus).
13. **JSON para el contenido del cambio**
    *Por qué:* los campos solicitables son pocos y pueden crecer; `datos_json` con antes/después evita migrar columnas con cada ajuste. La columna `estado` es para el ciclo de la solicitud (pendiente/resuelta); el destacado y orden en la Matriz se resuelven con el campo `solicitudCambioPendiente` del DTO del taller (un join), sin consultar ni parsear la tabla de solicitudes desde el listado.

**Supuestos a validar (revisión del usuario):**

| # | Pregunta | Propuesto |
|---|---|---|
| 1 | ¿La capacidad (3/día, 8/semana, foráneos) bloquea o solo avisa en modo ajuste? | **Avisa** (no bloquea); el motivo documenta la excepción |
| 2 | ¿La nueva fecha puede salir de la vigencia de la selección? | **Sí, con aviso** (es un imprevisto), sin salir de Lun–Vie |
| 3 | ¿El ajuste de taller toca recursos/costos (ADR-00008)? | **No**: solo fecha, hora, lugar y participantes |
| 4 | ¿Alguien más además de CEM debe ajustar (GV/AEM)? | **Solo CEM** por ahora; editable en el admin de permisos |
| 5 | ¿Dónde se consulta el historial de ajustes? | Botón **"Ajustes"** propio (además del Historial del workflow) |
| 6 | ¿Se audita también "Solicitar cambio" (cancelación de versión)? | **Sí (2026-10-09)**: `CANCELAR_VERSION` en `ajustes_post_cierre`; el motivo deja de perderse en logs |
| 7 | ¿Candados nuevos tipo `es_bloqueado` para rutas/talleres? | **No (2026-10-09)**: el estado final + el permiso bastan; `es_bloqueado` sigue solo en la matriz individual |
| 8 | ¿Flujo de autorización (solicitud → CEM aprueba) para los ajustes pequeños? | **No (2026-10-09)**: ajuste directo con permiso + motivo + auditoría; la solicitud formal se reserva a cambios estructurales |
| 9 | ¿Límite de tiempo para ajustar? | **`dias_limite_cambio` = 45 (2026-10-09)**, configurable en Parámetros; se valida contra la fecha original del taller/visita |
| 10 | ¿El ajuste de taller sincroniza la visita de ruta? | **Sí, automático (2026-10-09)**: mueve la visita en la misma transacción revalidando capacidad; si no cabe, rechaza |
| 11 | ¿Canal del equipo cuando el candado está puesto? | **Solicitud de cambio (2026-10-09)**; el CEM conserva el ajuste directo como vía rápida |
| 12 | ¿Dónde resuelve el CEM? | **Matriz General (2026-10-09)**: pendientes arriba con icono; sin bandeja nueva |
| 13 | ¿Notificación? | **In-app (campana/SSE) + correo (2026-10-09)** al CEM al solicitar y al solicitante al resolver |
| 14 | ¿Contenido y destacado de la solicitud? | **`datos_json` (2026-10-09)** + columnas mínimas (`id_solicitud`, `id_taller`, `estado`, auditoría); el destacado en Matriz usa `solicitudCambioPendiente` del DTO del taller (join), sin consultar la tabla |

### Fase 1 — Base de datos (script 0027)

`lefarma.database/educacion-medica/0027_20261009-1200_educacion-medica_create-ajustes-post-cierre.lefarma.sql`, idempotente, transacción única (estilo 0016/0021):

1. **Tabla `educacion_medica.ajustes_post_cierre`**:
   - `id_ajuste INT IDENTITY PK`
   - `entidad_tipo VARCHAR(20) NOT NULL` — CHECK `IN ('RUTA_VISITA','RUTA_VERSION','TALLER')`
   - `id_entidad INT NOT NULL` — `id_ruta_visita`, `id_ruta_version` o `id_taller`
   - `accion VARCHAR(30) NOT NULL` — CHECK (`MOVER_VISITA`, `EDITAR_HORAS`, `ALTA_VISITA`, `BAJA_VISITA`, `EDITAR_TALLER`, `CANCELAR_VERSION`)
   - `valores_antes NVARCHAR(MAX) NULL`, `valores_despues NVARCHAR(MAX) NULL` — JSON
   - `motivo NVARCHAR(500) NOT NULL`
   - `id_usuario INT NOT NULL`, `fecha_ajuste DATETIME2 NOT NULL DEFAULT SYSDATETIME()`
   - Índice `IX_ajustes_post_cierre_entidad (entidad_tipo, id_entidad)`
   - `MS_Description` en tabla y columnas.
2. **Tabla `educacion_medica.taller_solicitudes_cambio`** (decisiones 13–15):
   - `id_solicitud INT IDENTITY PK`, `id_taller INT NOT NULL` (FK física → `talleres`), `estado VARCHAR(15) NOT NULL` — CHECK (`Pendiente`|`Aprobada`|`Rechazada`|`Cancelada`)
   - `datos_json NVARCHAR(MAX) NULL` — el cambio completo: valores antes/después, motivos (solicitante/resolución) y actores
   - Auditoría estándar (`fecha_creacion/modificacion`, `id_usuario_creacion/modificacion`)
   - Índices: `IX_taller_solicitudes_cambio_taller (id_taller)` y `IX_taller_solicitudes_cambio_estado (estado)`
   - `MS_Description` (tabla y columnas).
3. **Parámetro `dias_limite_cambio`** en `educacion_medica.parametros_modulo` (default `45`; INSERT idempotente; editable en la pantalla Parámetros) — decisión 11.
4. Sin backfill (no hay datos en operación).
5. Los permisos van en el script compartido `0029` (ver ADR-00011 Fase 1).

### Fase 2 — Backend

1. **`RutasService`**
   - `mover visita`: acepta versión `Cerrada` cuando el usuario tiene `rutas.puede_ajustar` **y** envía `motivo`; escribe `ajustes_post_cierre` (`MOVER_VISITA`) en la misma transacción. Sin permiso o sin motivo → 403/400 (comportamiento actual intacto).
   - `PUT /{idRuta}/visitas/{idVisita}/horas` (nuevo): `horaSalida`/`horaLlegada`; en `Creada` sin motivo (edición normal), en `Cerrada` exige permiso de ajuste + motivo (`EDITAR_HORAS`).
   - `POST /{idRuta}/visitas` y `DELETE .../visitas/{idVisita}`: se extienden a `Cerrada` con permiso de ajuste + motivo (`ALTA_VISITA`/`BAJA_VISITA`); el alta normal sigue validando hospital de la selección y frontera región→equipo. Visitas extraordinarias: ADR-00011.
   - **Cancelación de versión** ("Solicitar cambio"): `CancelarAsync` agrega el registro `CANCELAR_VERSION` (entidad `RUTA_VERSION`, motivo obligatorio del request) en la misma transacción, **sin cambiar el bypass** del motor ni el comportamiento actual.
   - **Límite temporal**: los ajustes de ruta validan `dias_limite_cambio` contra la fecha original de la visita (decisión 11).
   - Respuesta con `avisos` de capacidad (no bloqueantes) en modo ajuste.
2. **`TalleresService.UpdateAsync`**
   - En `Autorizado`/`Programado` con `talleres.puede_ajustar` + motivo: permite solo `FechaTaller`, `HoraTaller`, `Lugar`, `NumeroParticipantes`; escribe `EDITAR_TALLER` con antes/después. El resto de campos sigue bloqueado fuera de la matriz en `Creada`.
   - **Límite temporal**: valida `dias_limite_cambio` contra la fecha original del taller (parámetro de `parametros_modulo`); fuera del plazo → error explicativo.
   - **Sincronización taller → ruta** (decisión 12): si cambia `FechaTaller`, busca la visita de la ruta activa (`id_seleccion_hospital`; extraordinaria por `id_hospital` + `es_extraordinaria`) y la mueve a la nueva fecha **en la misma transacción**, revalidando 3/día y 8/semana; si no cabe, error y rollback (sin cambio parcial).
3. **Consulta de ajustes**: `GET /api/educacion-medica/ajustes?entidadTipo=&idEntidad=` (permiso de ver del módulo: `rutas.puede_ver` / `talleres.puede_ver` según entidad).
4. **DTOs**: `motivo` opcional en requests; obligatorio solo cuando el documento está cerrado; `avisos` en respuesta.
5. **Permisos**: `[HasPermission(rutas.puede_ajustar)]` y `[HasPermission(talleres.puede_ajustar)]` por endpoint (el permiso de ajuste se valida en servicio porque el mismo endpoint sirve a ambos modos).
6. **Solicitudes de cambio de taller** (`TalleresService` + `TalleresController`; notificaciones con `INotificationService`, patrón `IncidenciasChecadoNotificacionService`):
   - `POST /talleres/{id}/solicitudes-cambio` (integrante del equipo; captura asistida del CEM): crea `Pendiente` con `datos_json`; notifica al CEM (in-app + correo).
   - **DTO del taller** (`MisTalleres` y matrices): campo `solicitudCambioPendiente` (`idSolicitud`, `datosJson`, solicitante, fecha) resuelto por join en lote; la Matriz ordena y destaca con ese campo, **sin endpoint de listado aparte**.
   - `POST /talleres/solicitudes-cambio/{id}/resolver {aprobar|rechazar, motivo}` (CEM, `talleres.puede_ajustar`): al aprobar reutiliza la lógica del ajuste (límite, sincronización de ruta, `ajustes_post_cierre`); al rechazar solo registra motivo; notifica al solicitante (in-app + correo).
7. **Pruebas unitarias**: mover en `Cerrada` con/sin permiso; motivo obligatorio; auditoría escrita con antes/después; taller en `Programado` ajustable y en `EnCurso` rechazado; **límite temporal (dentro y fuera de `dias_limite_cambio`)**; **sincronización taller → ruta con conflicto de capacidad → rollback sin cambio parcial**; **solicitud: crear/resolver, aprobar aplica + sincroniza, rechazar no aplica, notificación emitida**; no-regresión de los flujos en `Creada`.

### Fase 3 — Frontend

1. **`RutasPage`**
   - Con permiso `rutas.puede_ajustar` y versión `Cerrada`: banner informativo ("documento cerrado — los cambios quedan auditados") + switch **"Modo ajuste"**.
   - Dentro del modo: drag & drop habilitado; cada soltar/mover abre **diálogo de motivo**; edición de horas por visita; botón quitar con motivo; avisos de capacidad visibles.
   - Botón **"Ajustes"** (historial de `ajustes_post_cierre` de la versión, incluida la cancelación `CANCELAR_VERSION` cuando aplica).
   - Sin permiso: comportamiento actual (solo lectura + "Solicitar cambio").
2. **Talleres**
   - `TallerFormModal`/detalle: en `Autorizado`/`Programado` con permiso, habilitar fecha/hora/lugar/participantes + campo motivo; badge "Ajustado" cuando el taller tenga ajustes; acción "Historial de ajustes".
   - Aviso al cambiar la fecha: "Se moverá la visita de la ruta del {fecha original} al {fecha nueva}"; manejo explícito del error por capacidad o por límite de plazo.
   - `MatrizTalleresTable`/`MisTalleresPage`: indicador discreto de ajustes.
3. **Solicitudes de cambio (UI)**:
   - `MisTalleresPage`: con el candado puesto o la matriz fuera de captura, el botón **"Solicitar cambio"** abre un modal con los campos ajustables (diff antes/después hacia `datos_json`) y motivo; muestra el estado de la solicitud del taller (Pendiente/Aprobada/Rechazada).
   - `MatrizTalleresPage` (Matriz General): **pendientes arriba con icono** (usa `solicitudCambioPendiente` del DTO del taller) y acción Resolver (Autorizar/Rechazar con motivo); el panorama muestra el estado por taller y el avance por equipo.
   - Notificación **in-app (campana) + correo**: al CEM al crear; al solicitante al resolver (canales existentes, sin bandeja nueva).
4. **API/tipos**: `ajustes.listar`, `solicitudesCambio.*`, parámetros `motivo` y `avisos`.
5. `tsc` + ESLint + build en verde.

### Fase 4 — Verificación y cierre

- E2E: cerrar rutas → mover una visita con motivo (queda en `Cerrada` y auditada) → verificar que asignaciones/impresión reflejan el cambio; "Solicitar cambio" → verificar que el motivo quedó persistido (`CANCELAR_VERSION`); ajustar fecha/hora de un taller `Programado` → verificar rechazo en `EnCurso`; verificar 403 sin permiso.
- E2E: ajustar fecha de taller dentro del plazo → la visita de ruta se mueve en el mismo acto; con fecha original a más de `dias_limite_cambio` días → rechazo explicativo; conflicto de capacidad en el día destino → ajuste rechazado sin cambios parciales.
- E2E: equipo con candado puesto solicita cambio (hora) → campana al CEM → el taller aparece **arriba con icono** en Matriz General → CEM aprueba → se aplica (y la visita de ruta se mueve si es fecha) y queda en `ajustes_post_cierre`; caso rechazo → no cambia nada y el solicitante recibe aviso.
- Probar los supuestos de Fase 0 (capacidad, vigencia) y ajustar según respuesta del usuario.
- Sincronizar `tareas/00010`, `reglas-negocio.md` (§5.5/§5.6, nueva regla de ajustes) y diagramas si aplica.
- Marcar `Accepted` al aprobarse.

## Validación contra la operación documentada

| Ajuste digital | Fuente | Cita / dato |
|---|---|---|
| Reagenda de visitas como realidad operativa | `Procesos/Talleres Médicos en Hospitales.md` (nodo P2F) | *"EV: Notifica al GV para que reagende la visita para ofrecer el taller médico."* |
| Fecha y hora del taller son datos del formato | `Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` (guía de llenado, campos 8–9) | *"Fecha de taller: Escribir la fecha en la cual está programado el taller médico con el siguiente formato: dd/mm/aaaa"* · *"Hora: Escribir la hora en la cual se va a realizar el taller médico"* |
| La agenda admite lugar y hora por visita | `Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` (guía de llenado, campo 6) | *"Lugar y hora: Escribir el nombre del ejecutivo de ventas, hospital o lugar que va a visitar y la hora"* |
| Días laborables | `Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` | *"Las columnas S y D corresponden a Sábado y Domingo (días no laborables, sin registro de talleres)."* |

**Interpretación (no cita):** el mecanismo de ajuste con motivo + auditoría, los permisos exclusivos de CEM, la tabla `ajustes_post_cierre` y el modo ajuste en UI son decisiones de digitalización de este ADR; los documentos no describen un canal de cambio posterior al cierre, solo su necesidad operativa (reagenda).

## Consequences

**Positivas**
- La operación corrige imprevistos (fecha, hora, logística) sin repetir la cadena de firmas, manteniendo el documento publicado vigente.
- Trazabilidad completa del cambio: quién, cuándo, qué valores y por qué (`ajustes_post_cierre`).
- Permisos acotados (solo CEM) mantienen el principio de menor privilegio y el candado real en backend (ADR-00009).
- Cero cambios de esquema en las tablas de rutas/talleres: una tabla nueva y endpoints extendidos.
- La cancelación de versión ("Solicitar cambio") deja de perder el motivo: queda persistido en `ajustes_post_cierre` (`CANCELAR_VERSION`), y la decisión de **no agregar candados nuevos** mantiene el modelo simple (estado final + permiso).
- El equipo gana un canal claro cuando el candado está puesto (**solicitud de cambio**) con notificación y resolución visible en la Matriz General, sin construir una bandeja nueva; el CEM conserva la vía rápida.

**Negativas / neutrales**
- Coexisten tres vías de cambio (edición directa con captura abierta, solicitud del equipo con candado puesto y "Solicitar cambio" estructural): requiere copy claro en la UI para que el usuario elija la correcta.
- Un documento `Cerrada` puede divergir de la versión que se firmó; la auditoría es la compensación y el Historial del workflow ya no refleja esos cambios (se consultan en "Ajustes").
- La capacidad no bloqueante puede permitir sobrecargas puntuales (supuesto 1 sujeto a validación).

**Follow-ups**
- ADR-00011 (hospitales extraordinarios) usa este mecanismo para la visita extraordinaria.
- Si negocio pide firma o candado de capacidad, se ajusta el servicio sin cambiar el modelo.

## Anexo — Fuentes

**Documentales (referencias del módulo):**
- `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` — nodo P2F (reagenda).
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — campos fecha/hora del taller.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — agenda, lugar y hora por visita.

**Técnicas / relacionadas (no son fuentes documentales):**
- `decisiones/00004_reparto-y-planificacion-rutas.md` — decisión 12 (no se edita una ruta confirmada; ADR futuro de modificación).
- `decisiones/00006_workflow-seleccion-y-rutas.md` — principio "quién firma no edita".
- `decisiones/00008_modulo-imparticion-talleres.md` — estados del taller y cancelación con motivo.
- `decisiones/00009_permisos-y-guards-educacion-medica.md` — patrón de permisos y guards.
- Código actual: `RutasService` (`mover/agregar/quitar visita`, validación `esEditable`), `TalleresService.UpdateAsync` (candado por matriz en `Creada`), `RutasController`, `TalleresController`.
- `lefarma.database/educacion-medica/0007_20260827-1210_educacion-medica_create-regiones-rutas.lefarma.sql` — esquema de `rutas_visitas` (incluye `hora_salida`/`hora_llegada`).
- Script propuesto: `0027_20261009-1200_educacion-medica_create-ajustes-post-cierre.lefarma.sql`; permisos en `0029`.
