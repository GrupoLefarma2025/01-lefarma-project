# Workflow de Órdenes de Compra

Motor de workflow para la autorización de órdenes de compra. Controla el flujo de pasos, acciones, validaciones y notificaciones.

## Arquitectura

Implementado como vertical slice en `Features/OrdenesCompra/Firmas/`. El motor genérico vive en `Features/Config/Workflows/`.

### Motor de Workflow

`IWorkflowEngine` / `WorkflowEngine` — evalúa acciones, aplica handlers, determina el siguiente paso según condiciones.

- `FirmasService` — punto de entrada principal; coordina motor, repositorio y notificaciones.
- `WorkflowContext` — datos inmutables del contexto de la acción (orden, usuario, acción, comentario).
- `WorkflowResult` — resultado del motor: nuevo estado, nuevo paso, errores.

### Handlers

Los handlers son responsables de validar o actualizar campos de la orden antes de ejecutar la acción.

Solo existen 2 handler types:
- **`Field`** — valida si `requerido=1` Y escribe en `OrdenCompra` vía reflection. 1 fila por campo. Reemplaza la dupla RequiredFields+FieldUpdater.
- **`Document`** — valida que exista un archivo en BD con el tipo del campo. Si `validar_fiscal=1`:
  - Archivo imagen → pasa sin validación fiscal (las imágenes no son CFDI).
  - Archivo XML/PDF → placeholder para webservice SAT (Fase 2).
  - Columna `requerido` en handler: si `0`, el documento es opcional y el handler no bloquea.

Configuración 100% en BD (`workflow_accion_handlers` + `workflow_campos`). Agregar un nuevo campo no requiere cambios en C#.

## Notificaciones

El sistema de notificaciones se dispara automáticamente al completar una firma exitosa.

### Workflow Notification Dispatcher

`IWorkflowNotificationDispatcher` / `WorkflowNotificationDispatcher` — resuelve destinatarios, interpola templates y llama a `INotificationService.SendAsync()`.

- Se llama desde `FirmasService` como **fire-and-forget**: un fallo de notificación no revierte la firma.
- Siempre envía canal `in-app`; opcionalmente `email` y/o `telegram` según flags de `workflow_notificaciones`.

#### Resolución de destinatarios

Según los flags en `workflow_notificaciones`:

| Flag | Destinatario |
|------|-------------|
| `avisar_al_creador` | `orden.IdUsuarioCreador` |
| `avisar_al_anterior` | El usuario que ejecutó la acción (firmante actual) |
| `avisar_al_siguiente` | Participantes del paso destino (`workflow_participantes[id_paso=pasoDestino]`). Si tienen `id_rol`, se resuelven los usuarios del rol vía `AsokamDbContext.UsuariosRoles`. |

#### Tags de template

Templates en `workflow_notificaciones.cuerpo_template` soportan: `{{Folio}}`, `{{Total}}`, `{{Proveedor}}`, `{{Solicitante}}`, `{{NombreCreador}}`, `{{NombreSiguiente}}`, `{{Comentario}}`, `{{CentroCosto}}`, `{{CuentaContable}}`, `{{UrlOrden}}`, `{{ImportePagado}}`.

### Tablas involucradas

- `config.workflow_notificaciones` — 11 plantillas con flags de canales y tags
- `config.workflow_participantes` — quién puede actuar/recibir por paso (id_rol o id_usuario)
- `app.usuarios_roles` (AsokamDB) — resolución de usuarios por rol

## Pasos del proceso

| Paso | Nombre | Responsable |
|------|--------|-------------|
| 1 | Creación | Solicitante |
| 2 | Revisión Jefe | Jefe de área (rol) |
| 3 | CxP | Equipo CxP (rol) |
| 4 | GAF | Gerencia Administrativa (rol) |
| 5 | Autorización | Dirección (rol) |
| 6 | Pago | Tesorería (rol) |
| 7 | Comprobación | Área solicitante |

## Seed Data

Configuración canónica en `lefarma.docs/workflow/seed-data.sql`. DDL en `lefarma.docs/workflow/scripts.sql`.

## Comprobantes y Facturación CFDI

Módulo para subir y relacionar comprobantes (facturas CFDI o simples) con las partidas de órdenes de compra. Integrado en el workflow como un tab dentro de `AutorizacionesOC`.

### Modelo

- `operaciones.comprobantes` — cabecera del comprobante (CFDI o ticket/nota/recibo)
- `operaciones.comprobantes_conceptos` — conceptos extraídos del XML CFDI
- `operaciones.comprobantes_partidas` — tabla puente: relaciona conceptos/comprobantes con `ordenes_compra_partidas`

La relación principal es **Comprobante → Partida** (no directamente a la orden).

### Reglas de facturación

- `cantidad_facturada` y `importe_facturado` en `ordenes_compra_partidas` se actualizan al asignar
- `estado_facturacion`: 0=Pendiente, 1=Parcial, 2=Completa (calculado en servicio, tolerancia ±0.01)
- UUID CFDI único por empresa (índice filtrado `WHERE uuid_cfdi IS NOT NULL`)
- Facturación parcial y multi-orden (vía partidas) permitida

### Backend

- `Features/Facturas/ComprobanteService.cs` — lógica principal (parseo, subida, asignación)
- `Features/Facturas/Parsing/CfdiParser.cs` — parser CFDI 4.0 con `System.Xml.Linq`
- `Features/Facturas/ComprobanteController.cs` — 7 endpoints bajo `/api/facturas`

### Frontend

- `src/components/facturas/SubirComprobanteModal.tsx` — modal 4 pasos (tipo → archivos → asignar → listo)
- `src/services/comprobanteService.ts` — llamadas a los 7 endpoints
- `src/types/comprobante.types.ts` — tipos TypeScript del módulo
- Tab "Facturación" en `src/pages/ordenes/AutorizacionesOC.tsx`
