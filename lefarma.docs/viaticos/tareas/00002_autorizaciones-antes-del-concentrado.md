# Tarea — Punto de autorización antes del concentrado

> **Estado:** Implementado (2026-11-19). Backend, frontend y pruebas en verde.
>
> **Decisión:** [[decisiones/00002_autorizaciones-antes-del-concentrado]]
>
> **Alcance:** sin permisos nuevos, sin cambios de esquema y sin tocar la ruta legada `/viaticos/aprobaciones`.

## Objetivo

Insertar un punto de autorización entre «Mis viajes» y el concentrado, separar borradores de enviadas en Mis viajes y permitir que quien tiene `viaticos.ver_todos` consulte las solicitudes de todos.

Flujo resultante:

```
Solicitud (borrador) → Mis viajes (Borradores | Enviadas) → Autorizaciones → Concentrado
```

## Fase 1 — Backend

- [x] **1.1** `GET /api/viaticos/solicitudes/mis?todas=true` incluye las solicitudes ajenas cuando la persona tiene `viaticos.ver_todos`; sin el parámetro todo sigue igual.
  - [x] 403 con el nombre del permiso cuando se pide `todas` sin él.
  - [x] Sin sesión sigue respondiendo 401.
- [x] **1.2** Nuevo `GET /api/viaticos/solicitudes/por-autorizar`: exige `viaticos.autorizar`, filtra `activo` y `estado = 'enviada'`, ordena por fecha de creación descendente y devuelve el mismo `SolicitudDto` con opciones.
- [x] **1.3** Extraer `DirectorioDeCreadoresAsync` para resolver nombres de creador en lote.
- [x] **1.4** Pruebas en `SolicitudesControllerTests`: consulta ampliada con y sin `ver_todos`, cola con solo enviadas activas de todos, 403 sin permiso de autorizar y 401 sin token.
  - [x] `dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~Viaticos"` → 141 pruebas, 0 errores.

## Fase 2 — Frontend

- [x] **2.1** Extraer la tabla de solicitudes y los filtros a componentes compartidos (`SolicitudesViajeTable`, `FiltrosSolicitudes`) y los helpers de presentación a `viajes.helpers.ts`.
- [x] **2.2** Mis viajes con pestañas «Borradores» y «Enviadas»; la pestaña activa se lee y se escribe en la URL (`?pestana=`).
  - [x] Al enviar un borrador se navega a `?pestana=enviadas`.
  - [x] Solo los borradores propios ofrecen «Enviar a autorización», Editar y Eliminar; el resto solo «Ver detalle».
- [x] **2.3** Nueva página `/viaticos/autorizaciones` protegida con `viaticos.autorizar`.
  - [x] Lista todas las solicitudes pendientes con la misma tabla de Mis viajes.
  - [x] «Revisar» abre el detalle completo con «Autorizar» y «Rechazar» (rechazo bloqueado sin motivo).
  - [x] Al resolver se recarga la cola y se avisa en pantalla.
- [x] **2.4** Ruta y menú: `<Route path="autorizaciones">` con `PermissionGuard` y entrada «Autorizaciones» entre Mis viajes y Concentrado.
- [x] **2.5** Concentrado de solo lectura: por defecto «Autorizadas (listas para concentrar)»; «Enviadas» y «Todas» quedan como filtro; el detalle ya no autoriza, rechaza ni recalcula.
- [x] **2.6** Servicio: `solicitudesApi.misSolicitudes({ todas })` y `solicitudesApi.porAutorizar()`.
- [x] **2.7** Pruebas: Mis viajes (16), Autorizaciones (4), Concentrado (12) y ruteo (7).

## Fase 3 — Permisos

- [x] Reutilizar los permisos ya sembrados; no se crea ninguno nuevo.
  - [x] `viaticos.ver_todos` → consulta global en Mis viajes.
  - [x] `viaticos.autorizar` → ruta/menú de Autorizaciones y cola del servidor.
  - [x] `viaticos.solicitar` y `viaticos.ajustar` sin cambios.
- [x] Sin script de base de datos nuevo: `lefarma.database/viaticos/0003_20261007-0000_viaticos_permisos.sql` ya los siembra.

## Fase 4 — Pruebas y documentación

- [x] **4.1** Backend: suite de viáticos en verde.
- [x] **4.2** Frontend: `npx tsc --noEmit` limpio y `npx eslint` sin errores en los archivos tocados.
- [x] **4.3** Frontend: pruebas de las cuatro pantallas/rutas afectadas en verde.
- [x] **4.4** ADR [[decisiones/00002_autorizaciones-antes-del-concentrado]] y esta tarea.

## Fuera de alcance (mencionado, no ejecutado)

- Validación visual en navegador: el repo pide no abrir navegador salvo petición explícita.
- Publicación: no se publicó nada en pruebas ni en productivo.
- `filaVuelos.ts` / `ESTADOS_CONCENTRABLES` no se tocaron: el concentrado de vuelos puede seguir armándose antes de autorizar.

## Verificación

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas backend de viáticos | `dotnet test … --filter "FullyQualifiedName~Viaticos" --artifacts-path %TEMP%\lfar-artifacts` | 141 pruebas, 0 errores |
| Tipos del frontend | `npx tsc --noEmit` | Sin errores |
| Lint de los archivos tocados | `npx eslint …` | Sin errores |
| Pruebas de Mis viajes | `npx vitest run src/apps/viaticos/pages/mis-viajes/MisViajesPage.test.tsx` | 16/16 |
| Pruebas de Autorizaciones | `npx vitest run src/apps/viaticos/pages/autorizaciones/AutorizacionesPage.test.tsx` | 4/4 |
| Pruebas del concentrado | `npx vitest run src/apps/viaticos/pages/concentrado/ConcentradoPage.test.tsx` | 12/12 |
| Pruebas de ruteo | `npx vitest run src/apps/viaticos/ViaticosRoutes.test.tsx` | 7/7 |

> **Nota:** en `src/apps/viaticos` quedan 16 pruebas rojas en `SolicitudPage`, `ConfiguracionPage` y `ViaticosPage` (costos) por `localStorage` no disponible en el entorno de jsdom de esta máquina de trabajo. Se comprobó contra el árbol sin estos cambios: fallan igual, no son una regresión de este trabajo.
