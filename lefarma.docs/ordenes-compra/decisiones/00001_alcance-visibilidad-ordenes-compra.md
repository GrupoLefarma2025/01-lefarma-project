---
fecha_creacion: 2026-11-06
fecha_modificacion: 2026-11-06
resumen: Alcances acumulables de visibilidad (total, por empresa y por flujo) para la bandeja de autorización de órdenes de compra, resueltos en un único servicio del backend y aplicados a todas las lecturas de la orden.
---

## Status

Accepted (aprobado por el usuario el 2026-11-06; las decisiones marcadas como «supuesto» quedan sujetas a ajuste).

## Índice

1. [Contexto](#1-contexto)
2. [Estado actual](#2-estado-actual)
3. [Decisión](#3-decisión)
4. [Modelo de resolución](#4-modelo-de-resolución)
5. [Contratos de API y UI](#5-contratos-de-api-y-ui)
6. [Fases de implementación](#6-fases-de-implementación)
7. [Consecuencias](#7-consecuencias)
8. [Anexo: evidencia](#8-anexo-evidencia)

## 1. Contexto

En la pantalla «Órdenes pendientes para autorización» (`/cxp/ordenes/autorizaciones`) existe hoy un único permiso de visibilidad amplia: `orden_compra.puede_ver_todas_las_ordenes`. Sin él, un usuario ve únicamente las órdenes que creó y aquellas que están detenidas en un paso donde participa; al avanzar la orden, desaparece de su bandeja.

Se requiere un modelo intermedio: que ciertos usuarios puedan ver **todas las órdenes de una o varias empresas** y/o **todas las órdenes de los flujos en los que participan**, con filtros por empresa, flujo y solicitante. Ejemplo del usuario: Victor (usuario 74) participa en el flujo de Emmanuel (usuario 98); con el alcance por flujo debería ver tanto sus órdenes como las de Emmanuel aunque la orden ya haya avanzado.

## 2. Estado actual

- **La visibilidad es binaria.** `OrdenCompraService.GetAllAsync` aplica: si el usuario tiene `orden_compra.puede_ver_todas_las_ordenes` → sin filtro; si no → órdenes propias + órdenes en pasos donde participa (por usuario/rol) + órdenes cuyo jefe inmediato es el usuario, excluyendo los estados Creada (1), Rechazada (7) y Cancelada (9).
- **Los permisos son globales y sin alcance de datos.** Viven en Asokam (`app.Permisos`, `app.RolesPermisos`, `app.UsuariosPermisos`) y se administran en Admin › Roles / Usuarios / Permisos. Agregar un permiso = script idempotente (patrón `lefarma.database/053_permiso_ver_todas_ordenes_1a1.sql`).
- **La lista se pide completa y se filtra en el navegador.** `AutorizacionesOC.tsx` llama `GET /ordenes` sin parámetros; hoy hay 313 órdenes en producción.
- **Los flujos de OC están mapeados por usuario.** En `config.workflow_mappings` cada persona tiene su workflow (`scope = usuario`), con respaldo por empresa. En producción: usuario 74 (Victor) → workflow 6 «Workflow Asokam Victor»; usuario 98 (Emmanuel) → workflow 19 «Workflow Emmanuel»; y el paso 10 del workflow 19 tiene como participante al usuario 74.
- **La empresa del usuario no es fuente confiable.** `config.usuario_detalle.id_empresa` se autogenera con la primera empresa encontrada (`ProfileService.EnsureUsuarioDetalleAsync`), por lo que 114 usuarios quedaron en Artricenter por default.
- **Huecos de autorización existentes.** `GET /ordenes/{id}`, `GET /ordenes/{id}/historial-workflow`, `/acciones`, `/acciones/{idAccion}/metadata` no validan visibilidad; los controladores de órdenes no tienen `[Authorize]` ni `[HasPermission]` activo; y el claim de rol se emite como nombre mientras el controlador lo parsea a entero, por lo que el ramal «participa por rol» nunca aplica.

## 3. Decisión

Se adopta un modelo de **alcances acumulables** resueltos en un solo punto del backend (`IOrdenCompraVisibilidadService`):

| Alcance | Permiso (Asokam `app.Permisos`) | Qué amplía |
|---|---|---|
| Total | `orden_compra.puede_ver_todas_las_ordenes` (existente) | Todo; gana sobre los demás |
| Por empresa | `orden_compra.puede_ver_por_empresa` (nuevo) | Órdenes cuya `id_empresa` esté en las empresas asignadas al usuario |
| Por flujo | `orden_compra.puede_ver_por_flujo` (nuevo) | Órdenes cuyo `id_workflow` sea un flujo donde el usuario participa o esté mapeado a él |
| Base (implícito) | — | Órdenes propias + las detenidas en su paso + las de su jefe inmediato (comportamiento actual) |

Reglas:

1. Los alcances se **unen** (OR). `puede_ver_todas_las_ordenes` es superset y corta el cálculo.
2. «Participa en un flujo» = aparece como participante activo en cualquier paso de un workflow activo de `ORDEN_COMPRA` (por `id_usuario` o por rol vigente del usuario), **o** el flujo está mapeado a él en `workflow_mappings` con scope `USUARIO`, **o** creó una orden en ese flujo (cubierto por el alcance base).
3. El alcance por empresa usa una tabla nueva `config.usuario_alcance_empresa` (varias empresas por usuario, `activo` para baja lógica). Si el permiso está concedido pero no hay filas activas, **no amplía** (fail-closed).
4. El alcance se aplica **siempre** en el servidor; los filtros de UI solo acotan el conjunto ya permitido y nunca lo amplían. Una combinación fuera del alcance devuelve vacío.
5. El mismo servicio decide lista, detalle, acciones, historial, firmas y archivos: no puede haber políticas distintas de visibilidad entre pantallas.

**Supuestos aprobados para la primera entrega** (a confirmar si el negocio cambia el criterio):

- «Su flujo» = todos los flujos donde participa (Victor ve el 19 de Emmanuel porque firma en él), no solo el flujo mapeado a su usuario.
- El permiso se asigna por usuario y/o rol (ambos soportados por el sistema de permisos).
- Los aprobadores frecuentes (p. ej. Marco Polo, usuario 73, participante en casi todos los flujos) **no** reciben el permiso por defecto: con este criterio verían casi toda la bandeja.
- La asignación de empresas se hace inicialmente por script SQL; la pantalla de administración queda para una fase posterior.
- Los jefes de cada flujo son los participantes del paso «Aprobación Gerente General» de la configuración del workflow; se les asigna directamente `orden_compra.puede_ver_por_flujo` (script `0003`). Si la configuración del workflow cambia, se re-ejecuta el script para sincronizar altas (no revoca automáticamente).
- Los endpoints externos autenticados por `X-API-Key` quedan fuera de este alcance y se tratan en un ADR aparte.

## 4. Modelo de resolución

```
ResolverAsync(idUsuario):
  permisos   = UserPermissionService.GetPermissionsAsync(idUsuario)   // BD, cache 5 min
  verTodas   = permisos contiene "orden_compra.puede_ver_todas_las_ordenes"
  si verTodas: alcance = { VerTodas = true } y fin

  roles      = Asokam app.UsuariosRoles vigentes del usuario → ids de rol
  empresas   = config.usuario_alcance_empresa activas del usuario        // solo con permiso por empresa
  workflows  = mappings USUARIO del usuario ∪ workflows con participante activo
               (por id_usuario o por id_rol ∈ roles)                      // solo con permiso por flujo
  pasos      = pasos con participante activo (id_usuario o id_rol ∈ roles)
  jefe       = pasos que requieren jefe inmediato → nivel mínimo por paso
  creadores  = creadores de órdenes detenidas en pasos de jefe cuyo jefe efectivo es el usuario

Aplicar(query):
  si VerTodas → query
  si no       → query.Where(o =>
        o.IdUsuarioCreador == idUsuario
     || creadores.Contains(o.IdUsuarioCreador)
     || empresas.Contains(o.IdEmpresa)
     || workflows.Contains(o.IdWorkflow)
     || (pasos.Contains(o.IdPasoActual) && o.IdEstado ∉ {1,7,9}))

PuedeVerAsync(idOrden):
  carga { creador, empresa, workflow, pasoActual } de la orden
  VerTodas ∨ creador == usuario ∨ empresa ∈ empresas ∨ workflow ∈ workflows
  ∨ paso ∈ pasos ∨ jefeEfectivo(paso, creador) == usuario
```

El cálculo de empresas, flujos y pasos se hace con consultas por lote (sin N+1 por orden). La comprobación de jefe reutiliza `IJefeInmediatoResolver` con la misma caché por `(workflow, creador, nivel)` que ya usa la bandeja.

## 5. Contratos de API y UI

- `GET /api/ordenes` acepta además `idWorkflow` e `idUsuarioCreador` (empresa y sucursal ya existían) y **siempre** combina el alcance con los filtros por AND (los filtros no pueden ampliarlo). El response agrega `nombreWorkflow` para poder rotular el filtro de flujo sin permisos de configuración.
- `GET /api/ordenes/{id}` y `GET /api/ordenes/{id}/{acciones|acciones/{id}/metadata|historial-workflow}` responden 403 si `PuedeVerAsync` es falso. `POST /{id}/firmar` conserva la validación de participante del paso como defensa adicional.
- `FirmasService.PuedeVerOrdenAsync` delega en el servicio único (firma de eventos de bitácora).
- UI: filtros «Empresa» (`puede_ver_por_empresa` o total), «Flujo» (`puede_ver_por_flujo` o total) y «Solicitante» (visible si tiene cualquiera de los tres alcances; se alimenta del conjunto ya acotado). Se agrega columna «Empresa» opcional y el subtítulo indica el alcance aplicado.
- La asignación de permisos y de empresas no se automatiza en esta entrega: script SQL + Admin › Usuarios (permisos directos) existente.

## 6. Fases de implementación

1. **Fase 0 — Seguridad y unificación**: entidad/tabla de alcance por empresa, servicio único de visibilidad, guards en detalle/acciones/historial, delegación desde `FirmasService`, roles resueltos en servidor.
2. **Fase 1 — Bandeja**: `GetAllAsync` con alcance + filtros server-side + `nombreWorkflow`; frontend con filtros y gating por permisos.
3. **Fase 2 — Administración**: endpoints y pantalla para asignar empresas visibles por usuario; validaciones y bitácora.
4. **Fase 3 — Datos y difusión**: limpiar `config.usuario_detalle.id_empresa`, revisar mappings de workflow sin empresa y asignar permisos a las personas acordadas.

## 7. Consecuencias

**Positivas**

- Elimina el salto binario «todo o solo mi paso»: los aprobadores ven el flujo completo y dejan de perder órdenes al avanzar.
- Una sola política de visibilidad para lista, detalle, historial y firmas; se cierran huecos de lectura por ID.
- Los filtros de empresa/flujo/solicitante salen del propio conjunto permitido, sin exponer catálogos completos.
- La configuración por empresa es auditable (tabla con `activo`) y no depende de un dato autogenerado.

**Negativas**

- Requiere una tabla nueva y un script de permisos en Asokam; hasta ejecutarlos la funcionalidad queda inerte (fail-closed).
- El permiso por flujo puede ser muy amplio para aprobadores que participan en casi todos los flujos; exige criterio al asignarlo.
- Los filtros de UI siguen siendo en cliente sobre 313 filas; si la bandeja crece conviene paginación server-side.

**Neutras**

- Los alcances son acumulables; no hay jerarquía entre empresa y flujo.
- El acceso a la firma de un evento de OC usa ahora la misma política de visibilidad: un actor histórico que ya no está en el paso actual deja de ver la firma salvo que tenga alcance por empresa, flujo o total (antes bastaba con haber participado en la bitácora).
- El alcance por flujo depende de la calidad de `workflow_mappings`: hay empresas sin mapping y el fallback por `codigo_proceso` es no determinista con 13 workflows de OC.

## 8. Anexo: evidencia

Evidencia técnica levantada el 2026-11-06 (solo lectura, sin modificar datos):

- Código: `OrdenCompraService.GetAllAsync` (filtro actual por participante), `OrdenCompraController` (claims de rol), `FirmasService.PuedeVerOrdenAsync` (tercera política), `ProfileService.EnsureUsuarioDetalleAsync` (empresa por default), `WorkflowResolver` (mapeo por scope).
- Producción `Lefarma`: 313 órdenes; por empresa: Asokam (7) 275, Grupo Lefarma (12) 18, Lefarma (8) 10, Artricenter (1) 4, Pickneys (17) 4, Reumedika (15) 2; empresas sin órdenes: Construmedika (11), Farmalic (14), V-young (16), Argosol (18).
- Producción `Lefarma.config.workflow_mappings` (OC): mappings `usuario` 25→2, 40→1, 74→6, 98→19, 75→8, 51→16, 44→17, 64→1020, 34→9; mappings `empresa` 7→2, 11→4, 12→1, 1→5.
- Producción `Asokam.app.Usuarios`: 74 = 1a130 Victor Manuel Gonzalez Betanzos; 98 = 1a42 Emmanuel Lopez Perez; 73 = 44 Marco Polo Narvaez Oropeza; 25 = 1a41 Adriana Arredondo Ortiz.
- No hay documentación legacy (PDF) que contradiga esta decisión; el catálogo de permisos y el motor de workflow ya operan en Lefarma/Asokam y son la fuente para `app.Permisos`.

Seguimiento: ADR de endpoints externos (`X-API-Key`) y ADR de paginación de la bandeja si el volumen crece.
