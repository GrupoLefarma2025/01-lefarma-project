# Tareas — ADR 00001: alcances de visibilidad de órdenes de compra

Implementa [`decisiones/00001_alcance-visibilidad-ordenes-compra.md`](../decisiones/00001_alcance-visibilidad-ordenes-compra.md).

Estado al 2026-11-06: backend y frontend de la primera entrega implementados y compilando; faltan ejecutar scripts y la administración (fases 2-3).

## Fase 0 — Seguridad y servicio único de visibilidad

- [x] **T0.1 Entidad y tabla de alcance por empresa**
  - `Domain/Entities/Config/UsuarioAlcanceEmpresa.cs` (`IdUsuario`, `IdEmpresa`, `Activo`, `FechaCreacion`, `FechaModificacion`, nav `Empresa`).
  - `Infrastructure/Data/Configurations/Config/UsuarioAlcanceEmpresaConfiguration.cs` → tabla `config.usuario_alcance_empresa`, PK compuesta `(id_usuario, id_empresa)`, FK restrictiva a `catalogos.empresas`, índice por `id_usuario`.
  - `DbSet<UsuarioAlcanceEmpresa>` en `ApplicationDbContext`.
  - Script SQL: `lefarma.database/ordenes-compra/0002_20261106-1310_ordenes-compra_tabla-alcance-empresa.sql`.
  - Verificación: `dotnet build` sin errores.

- [x] **T0.2 Permisos nuevos en Asokam**
  - `lefarma.database/ordenes-compra/0001_20261106-1310_ordenes-compra_permisos-alcance.sql`: inserta `orden_compra.puede_ver_por_empresa` y `orden_compra.puede_ver_por_flujo` (idempotente) y deja ejemplos comentados de asignación.
  - Constantes `VerTodas`, `VerPorEmpresa`, `VerPorFlujo` en `Shared/Constants/AuthorizationConstants.cs`.
  - No se asigna por defecto: la asignación la decide el negocio.

- [x] **T0.3 Servicio `IOrdenCompraVisibilidadService`**
  - `Features/OrdenesCompra/Visibilidad/`: `AlcanceOrdenCompra`, interfaz y `OrdenCompraVisibilidadService`.
  - `ResolverAsync`: permisos vía `UserPermissionService` (BD), roles vigentes desde Asokam por `id_rol` (corrige el ramal por rol), empresas desde la tabla nueva, flujos desde mappings scope `USUARIO` + participantes por usuario/rol, pasos y jefe inmediato con la caché existente.
  - `Aplicar` y `PuedeVerAsync`; registro en `Program.cs`.
  - Pruebas: `tests/Lefarma.UnitTests/Features/OrdenesCompra/OrdenCompraVisibilidadTests.cs` (9 pruebas, todas en verde). Cubren total, empresa, flujo, rol vigente/expirado, base, jefe inmediato y `PuedeVerAsync`.

- [x] **T0.4 Guards de lectura**
  - `OrdenCompraController.GetById` → 403 si `!PuedeVerAsync`.
  - `OrdenCompraFirmasController`: `GetAcciones`, `GetAccionMetadata`, `GetHistorialWorkflow` → 403 si `!PuedeVerAsync`.
  - `FirmasService.PuedeVerOrdenAsync` delega en el servicio nuevo.
  - Pendiente (fuera de esta entrega): endpoints externos `X-API-Key` y escrituras (`Create`/`Update`/`Delete`/`Firmar` conservan sus validaciones actuales).

## Fase 1 — Bandeja de autorizaciones

- [x] **T1.1 `GetAllAsync` con alcance y filtros**
  - Firma `GetAllAsync(OrdenCompraRequest query, int idUsuario, AlcanceOrdenCompra alcance, CancellationToken ct = default)`.
  - Filtro anterior de permiso/participante sustituido por `Aplicar`.
  - `IdWorkflow` e `IdUsuarioCreador` en `OrdenCompraRequest`; `NombreWorkflow` en `OrdenCompraResponse` (lista y detalle, nombres por lote desde `config.workflows`).
  - Verificación: `dotnet build` sin errores; `dotnet test tests/Lefarma.UnitTests --filter OrdenCompraVisibilidad` → 9/9.

- [x] **T1.2 Frontend `AutorizacionesOC.tsx`**
  - `nombreWorkflow` en `types/ordenCompra.types.ts`.
  - Filtros Empresa, Flujo y Solicitante; predicado en cliente sobre el conjunto ya acotado por el backend. El filtro Empresa se muestra siempre (a petición del usuario, 2026-11-06); Flujo y Solicitante conservan el gating por permisos.
  - Columna «Empresa» y etiqueta de alcance en el subtítulo.
  - `tableId` versionado a `autorizaciones-oc-v2`: una configuración de tabla guardada antes de la columna nueva la ocultaba (mismo criterio que `mis-viajes-v4` y `viaticos-concentrado-v3`).
  - Verificación: `npm run build` sin errores; `npm run lint` sin problemas nuevos respecto al baseline.

## Fase 2 — Administración

- [ ] **T2.1 Endpoints de alcance por empresa** (`GET/PUT /api/admin/usuarios/{id}/alcance-empresas`) con permiso de administración y bitácora.
- [ ] **T2.2 UI en Admin › Usuarios**: sección «Empresas visibles» (checklist por usuario).

## Fase 3 — Datos y difusión

- [ ] **T3.1** Limpiar `config.usuario_detalle.id_empresa` autogenerado y documentar el criterio por empresa.
- [ ] **T3.2** Revisar `workflow_mappings` de OC: empresas sin mapping y fallback no determinista.
- [ ] **T3.3** Ejecutar scripts en el entorno acordado, asignar los permisos a 1a130 (Victor) y 1a42 (Emmanuel) y las empresas visibles; verificar con la bandeja (el usuario debe re-loguearse o esperar el SSE de permisos).
  - Parcial 2026-11-06: en producción se creó `orden_compra.puede_ver_por_flujo` y se asignó a los jefes de pasos «Aprobación Gerente General» (21, 23, 34, 46, 74; 39 excluido por inactivo) con los cambios `20261106-132853-7df8e7` y `20261106-132909-8f901b`. Falta publicar el backend, dar de alta `puede_ver_por_empresa`, la tabla `config.usuario_alcance_empresa` y asignar empresas.

## Criterios de aceptación

1. Un usuario con `puede_ver_por_empresa` y empresas asignadas ve solo órdenes de esas empresas, incluidas las de otros creadores.
2. Un usuario con `puede_ver_por_flujo` ve todas las órdenes de los flujos donde participa, sin importar el paso actual ni el creador (caso Victor/Emmanuel).
3. Un usuario con `puede_ver_todas_las_ordenes` sigue viendo todo y no pierde ninguno de los filtros actuales.
4. Un usuario sin permisos conserva exactamente el comportamiento actual (propias + paso actual).
5. `GET /ordenes/{id}`, historial y acciones responden 403 a quien no puede ver la orden.
6. Los filtros de UI nunca muestran opciones fuera del alcance ni amplían el conjunto recibido.
