---
fecha_creacion: 2026-11-19 15:45
fecha_modificacion: 2026-11-19 15:45
resumen: Punto de autorización intermedio entre «Mis viajes» y el concentrado; pestañas Borradores/Enviadas y permiso de consulta global.
---

# 00002 — Autorizaciones antes del concentrado

## Status

Accepted

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
- [[#Fase 1 — Backend|Fase 1 — Backend]]
- [[#Fase 2 — Frontend|Fase 2 — Frontend]]
- [[#Fase 3 — Permisos|Fase 3 — Permisos]]
- [[#Fase 4 — Pruebas y documentación|Fase 4 — Pruebas]]
- [[#Consequences|Consequences]]
- [[#Anexo — Archivos implicados|Anexo — Archivos implicados]]

## Decisión

El concentrado deja de ser el primer punto de revisión. La solicitud recorre ahora cuatro pantallas con un punto de autorización explícito en medio:

```
Solicitud (borrador) → Mis viajes (Borradores | Enviadas) → Autorizaciones → Concentrado
```

1. **Mis viajes** separa lo que aún es borrador de lo que ya se envió. Las pestañas viven en la URL (`?pestana=borradores|enviadas`) para que el enlace sea compartible y el envío pueda aterrizar en la pestaña correcta.
2. **`/viaticos/autorizaciones`** es una pantalla nueva, protegida con `viaticos.autorizar`, que lista **todas** las solicitudes en estado `enviada` de cualquier persona. Reutiliza la misma tabla de Mis viajes y añade las dos únicas salidas del punto: autorizar (pasa al concentrado) o rechazar con motivo.
3. **Concentrado** entra por defecto en «Autorizadas (listas para concentrar)» y deja de autorizar: es una pantalla de consulta, selección e impresión. «Enviadas» queda como filtro manual para quien necesite ver lo que todavía no llegó.
4. **`viaticos.ver_todos`** amplía Mis viajes: quien lo tiene ve las solicitudes de todos los usuarios, incluidos los borradores ajenos. Esos borradores ajenos solo se pueden consultar; enviar, editar y eliminar siguen siendo del dueño.
5. No se crea un permiso nuevo: `viaticos.autorizar` ya existía para el concentrado y ahora protege Autorizaciones; `viaticos.ver_todos` ya existía y solo se expone en Mis viajes.

**Por qué:** el equipo autorizador necesitaba ver la cola completa y decidir sin mezclarse con el armado del documento. Poner la decisión en el concentrado obligaba a autorizar con el documento ya abierto y confundía «lo que voy a concentrar» con «lo que todavía no se autoriza». Separar la cola también permite que el concentrado se arme solo con solicitudes aprobadas, que es su uso real.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **1** | Backend | Consulta propia ampliada y endpoint de la cola de autorización | Pruebas del controlador con permisos y estados |
| **2** | Frontend | Pestañas, pantalla de autorizaciones, concentrado de consulta | Pruebas de las páginas y del ruteo |
| **3** | Permisos | Reutilización de `viaticos.ver_todos` y `viaticos.autorizar` | Ruta protegida y respuestas 403 del servidor |
| **4** | Pruebas y documentación | Cobertura unitaria y ADR/tarea | Suites de viáticos en verde |

---

## Fase 1 — Backend

> Tarea: [[tareas/00002_autorizaciones-antes-del-concentrado#Fase 1 — Backend]]

- `GET /api/viaticos/solicitudes/mis?todas=true` devuelve también las solicitudes ajenas cuando la persona tiene `viaticos.ver_todos`. Sin el parámetro el endpoint sigue devolviendo solo lo propio, por lo que ningún cliente existente cambia de comportamiento.
- El permiso se comprueba en el servidor: pedir `todas=true` sin `viaticos.ver_todos` responde 403 con el nombre del permiso faltante. La UI nunca es la única barrera.
- `GET /api/viaticos/solicitudes/por-autorizar` es la cola del punto intermedio: exige `viaticos.autorizar`, filtra `activo = 1` y `estado = 'enviada'`, ordena de la más reciente a la más antigua y devuelve el mismo `SolicitudDto` que el detalle (opciones incluidas) para que la tabla y el diálogo de revisión compartan formato con Mis viajes.
- Se extrajo `DirectorioDeCreadoresAsync` para resolver el nombre de quien creó cada solicitud en lote, en lugar de repetir la consulta por fila.
- No cambia el contrato de autorizar/rechazar: Autorizaciones usa los endpoints existentes (`POST /api/viaticos/solicitudes/{id}/autorizar` y `.../rechazar`), que ya validan el estado `enviada` y devuelven 409 si la solicitud se movió antes.

## Fase 2 — Frontend

> Tarea: [[tareas/00002_autorizaciones-antes-del-concentrado#Fase 2 — Frontend]]

- La tabla de solicitudes y los filtros de periodo/tipo se extrajeron a `SolicitudesViajeTable` y `FiltrosSolicitudes` para que Mis viajes y Autorizaciones no dupliquen columnas, orden, paginación ni estilos.
- Mis viajes renderiza dos pestañas con conteo y escribe la pestaña activa en la URL; al enviar un borrador navega a `?pestana=enviadas`.
- Los botones de envío y el menú Editar/Eliminar aparecen solo cuando la fila es un borrador propio. Cualquier otro caso muestra únicamente «Ver detalle».
- Autorizaciones monta la tabla compartida con una acción «Revisar» que abre un diálogo con el detalle completo (mismo `VistaDetalle`) y las dos salidas del punto: «Autorizar» y «Rechazar» (deshabilitada hasta escribir el motivo).
- Concentrado deja de pedir cálculos y de mutar estado: su diálogo muestra el detalle en modo consulta y solo permite cerrar. La definición de «activo» por defecto pasa a ser «Autorizadas»; «Todas» y «Enviadas» siguen disponibles como filtro.
- La ruta legada `/viaticos/aprobaciones` se conserva sin cambios para no romper enlaces existentes.

## Fase 3 — Permisos

> Tarea: [[tareas/00002_autorizaciones-antes-del-concentrado#Fase 3 — Permisos]]

| Permiso | Dónde se usa | Comportamiento |
|---|---|---|
| `viaticos.solicitar` | Crear y editar lo propio | Sin cambios |
| `viaticos.ver_todos` | `GET .../mis?todas=true` y Mis viajes | Ve todas las solicitudes, borradores ajenos incluidos, solo en consulta |
| `viaticos.autorizar` | Ruta y menú de Autorizaciones; `GET .../por-autorizar` | Ve la cola completa y puede autorizar o rechazar |
| `viaticos.ajustar` | Ajustes del concentrado | Sin cambios |

Los cuatro permisos ya estaban sembrados en `lefarma.database/viaticos/0003_20261007-0000_viaticos_permisos.sql`; no hay script de base de datos nuevo.

## Fase 4 — Pruebas y documentación

> Tarea: [[tareas/00002_autorizaciones-antes-del-concentrado#Fase 4 — Pruebas y documentación]]

- Backend: pruebas de `SolicitudesController` para la consulta ampliada (con y sin permiso) y la cola de autorización (estados, `activo`, 403 y 401).
- Frontend: pruebas de Mis viajes (pestañas, URL, consulta global), Autorizaciones (listar, autorizar, rechazar, error de carga), Concentrado (solo consulta, definición por defecto) y ruteo del subárbol.
- Sin cambios de esquema ni migraciones.

## Consequences

**Positivas**

- La autorización tiene una cola única y clara, separada del documento que se imprime.
- El concentrado se arma con solicitudes aprobadas por defecto; ya no mezcla la decisión con el armado.
- Quien tiene `viaticos.ver_todos` puede supervisar el trabajo de todos sin pedir prestada la pantalla de autorización.

**Negativas**

- Hay una pantalla más en el flujo: quien autoriza ya no lo hace desde el concentrado.
- Dos consultas nuevas por parámetro (`todas`) y por endpoint (`por-autorizar`) que hay que mantener con el mismo DTO.

**Neutras**

- El botón de envío cambia de nombre («Enviar a autorización») y de destino (pestaña Enviadas) en lugar de saltar al concentrado.
- La ruta legada `/viaticos/aprobaciones` sigue viva aunque el menú ya no la ofrezca.

## Anexo — Archivos implicados

**Backend**

- `lefarma.backend/src/Lefarma.API/Features/Viaticos/SolicitudesController.cs` — `mis?todas=true`, `por-autorizar`, `DirectorioDeCreadoresAsync`.
- `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/SolicitudesControllerTests.cs` — pruebas de la consulta ampliada y de la cola.

**Frontend**

- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/MisViajesPage.tsx` — pestañas, URL y consulta global.
- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/SolicitudesViajeTable.tsx` — tabla compartida.
- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/FiltrosSolicitudes.tsx` — filtros compartidos.
- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/viajes.helpers.ts` — presentación de filas.
- `lefarma.frontend/src/apps/viaticos/pages/autorizaciones/AutorizacionesPage.tsx` — cola de autorización.
- `lefarma.frontend/src/apps/viaticos/pages/autorizaciones/RevisarSolicitudDialog.tsx` — detalle y salidas del punto.
- `lefarma.frontend/src/apps/viaticos/pages/concentrado/ConcentradoPage.tsx` — consulta, selección e impresión.
- `lefarma.frontend/src/apps/viaticos/ViaticosRoutes.tsx` y `menuItems.tsx` — ruta y entrada de menú.
- `lefarma.frontend/src/apps/viaticos/services/solicitudes.api.ts` — `misSolicitudes({ todas })` y `porAutorizar()`.

**Permisos**

- `lefarma.backend/src/Lefarma.API/Shared/Constants/AuthorizationConstants.cs` — `viaticos.ver_todos`, `viaticos.autorizar`.
- `lefarma.database/viaticos/0003_20261007-0000_viaticos_permisos.sql` — siembra vigente, sin cambios.
