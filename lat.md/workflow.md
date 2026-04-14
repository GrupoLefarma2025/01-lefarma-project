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
- **`RequiredFields`** — valida que campos requeridos estén presentes. Soporta `tipo_control=Archivo` (valida que exista archivo en BD) y `tipo_control=Checkbox` (bool). `ValidarFiscal=true` → placeholder CFDI webservice (TODO fase 2).
- **`FieldUpdater`** — escribe valores en la entidad `OrdenCompra` via reflection. Usa `propiedad_entidad` para saber qué campo tocar y `tipo_control` para el cast correcto.

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
