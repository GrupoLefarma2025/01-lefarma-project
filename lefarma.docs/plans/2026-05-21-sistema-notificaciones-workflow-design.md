\# Plan de Mejoras al Sistema de Notificaciones de Workflow



\## Fecha: 2026-05-21

\## Estado: Pendiente de aprobación



\---



\## 1. Resumen Ejecutivo



El sistema actual de notificaciones del workflow tiene limitaciones en la precisión de los destinatarios:

\- "Autorizadores previos" consulta la bitácora sin distinguir pasos del workflow

\- No existe la opción de notificar al "paso anterior" (del que vino la orden)

\- No hay forma de excluir participantes específicos o pasos completos de las notificaciones



Este plan propone mejorar la precisión y flexibilidad del sistema de notificaciones.



\---



\## 2. Problemas Actuales



\### 2.1 "Avisar al Anterior" es confuso

\- Actualmente significa "notificar al firmante actual" (quien ejecutó la acción)

\- El nombre genera confusión con "paso anterior"



\### 2.2 "Autorizadores Previos" usa bitácora crudamente

\- Consulta TODOS los registros de bitácora con acción "APROBAR"

\- No distingue entre pasos del workflow

\- Incluye al usuario actual si previamente aprobó

\- No respeta la estructura secuencial del workflow



\### 2.3 Falta "Avisar al Paso Anterior"

\- No hay forma de notificar específicamente al paso del que vino la orden

\- Útil cuando una orden regresa o avanza y se necesita informar al paso anterior



\### 2.4 No hay exclusiones de notificaciones

\- No se puede marcar un participante para que no reciba notificaciones

\- No se puede desactivar notificaciones a nivel de paso



\---



\## 3. Mejoras Propuestas



\### 3.1 Renombrar "Avisar al Anterior" → "Avisar al Firmante Actual"



\*\*Cambio:\*\*

\- Label en UI: "Avisar al firmante actual" (en lugar de "Avisar al anterior")

\- Comportamiento: Sin cambios, notifica al `idUsuarioActual` que ejecutó la acción

\- Campo en BD: `avisar\_al\_anterior` (sin cambio de nombre para evitar migración)



\*\*Motivación:\*\* Claridad semántica. El usuario que firma es el "firmante actual", no el "anterior".



\*\*Variable de Template:\*\*

\- Actualmente existe `NombreAnterior` que en realidad es el firmante actual

\- \*\*Nueva variable:\*\* `NombreFirmanteActual` = nombre del usuario que ejecutó la acción

\- \*\*Corregir:\*\* `NombreAnterior` debe ser el nombre del paso anterior (cuando aplique)



\---



\### 3.2 Nueva Opción: "Avisar al Paso Anterior"



\*\*Comportamiento:\*\*

\- Notifica a los participantes del paso del que vino la orden

\- Se determina consultando la bitácora: último `IdPaso` registrado antes del paso actual

\- Incluye usuarios directos (`IdUsuario`) y usuarios de roles (`IdRol`) de ese paso



\*\*Variable de Template:\*\*

\- `NombreFirmanteActual` = nombre del usuario que ejecutó la acción (nueva variable)

\- `NombreAnterior` = nombre del usuario del paso anterior (obtenido de participantes o bitácora)

\- Esto corrige el uso actual donde `NombreAnterior` en realidad es el firmante actual



\*\*Implementación de Variables:\*\*

```csharp

// Nombre del firmante actual (quien ejecutó la acción)

var nombreActual = await \_asokamContext.Usuarios

&#x20;   .Where(u => u.IdUsuario == idUsuarioActual)

&#x20;   .Select(u => u.NombreCompleto)

&#x20;   .FirstOrDefaultAsync(ct) ?? "el usuario";



// Nombre del paso anterior (si aplica)

var nombreAnterior = "el paso anterior";

if (notif.AvisarAlPasoAnterior)

{

&#x20;   var ultimoPasoAnterior = await \_context.WorkflowBitacoras

&#x20;       .Where(b => b.IdOrden == orden.IdOrden \&\& b.IdPaso != pasoActual.IdPaso)

&#x20;       .OrderByDescending(b => b.FechaEvento)

&#x20;       .Select(b => b.IdPaso)

&#x20;       .FirstOrDefaultAsync(ct);

&#x20;   

&#x20;   var participanteAnterior = await \_context.WorkflowParticipantes

&#x20;       .Where(p => p.IdPaso == ultimoPasoAnterior \&\& p.Activo \&\& p.IdUsuario.HasValue)

&#x20;       .FirstOrDefaultAsync(ct);

&#x20;   

&#x20;   if (participanteAnterior != null)

&#x20;   {

&#x20;       var nombre = await \_asokamContext.Usuarios

&#x20;           .Where(u => u.IdUsuario == participanteAnterior.IdUsuario.Value)

&#x20;           .Select(u => u.NombreCompleto)

&#x20;           .FirstOrDefaultAsync(ct);

&#x20;       if (!string.IsNullOrEmpty(nombre))

&#x20;           nombreAnterior = nombre;

&#x20;   }

}



// En el contexto del template:

contextoTemplate\["NombreFirmanteActual"] = nombreActual;

contextoTemplate\["NombreAnterior"] = nombreAnterior;

contextoTemplate\["Usuario"] = nombreActual;

```



\*\*Implementación:\*\*

```csharp

// Consultar último paso anterior desde bitácora

var ultimoPasoAnterior = await \_context.WorkflowBitacoras

&#x20;   .Where(b => b.IdOrden == orden.IdOrden \&\& b.IdPaso != pasoActual.IdPaso)

&#x20;   .OrderByDescending(b => b.FechaEvento)

&#x20;   .Select(b => b.IdPaso)

&#x20;   .FirstOrDefaultAsync(ct);



// Obtener participantes de ese paso

var participantesPasoAnterior = await \_context.WorkflowParticipantes

&#x20;   .Where(p => p.IdPaso == ultimoPasoAnterior \&\& p.Activo)

&#x20;   .ToListAsync(ct);



// Resolver nombre del paso anterior

var nombreAnterior = "el paso anterior";

var participanteAnterior = participantesPasoAnterior.FirstOrDefault();

if (participanteAnterior?.IdUsuario.HasValue == true)

{

&#x20;   var nombre = await \_asokamContext.Usuarios

&#x20;       .Where(u => u.IdUsuario == participanteAnterior.IdUsuario.Value)

&#x20;       .Select(u => u.NombreCompleto)

&#x20;       .FirstOrDefaultAsync(ct);

&#x20;   if (!string.IsNullOrEmpty(nombre))

&#x20;       nombreAnterior = nombre;

}

```



\*\*Campo en BD:\*\*

```sql

ALTER TABLE config.workflow\_notificaciones 

ADD COLUMN avisar\_al\_paso\_anterior BIT DEFAULT 0;

```



\---



\### 3.3 Mejorar "Avisar a Autorizadores Previos"



\*\*Comportamiento actual (PROBLEMA):\*\*

\- Consulta bitácora filtrando por `TipoAccionCodigo == "APROBAR"`

\- No distingue en qué paso aprobaron

\- Incluye al usuario actual



\*\*Nuevo comportamiento:\*\*

1\. Obtener el paso actual de la orden

2\. Obtener todos los pasos anteriores en el workflow (por campo `Orden`)

3\. Consultar bitácora filtrando:

&#x20;  - `IdOrden == orden.IdOrden`

&#x20;  - `IdPaso` está en la lista de pasos anteriores

&#x20;  - `IdUsuario != idUsuarioActual` (excluir al actual)

4\. Obtener usuarios distintos que participaron en esos pasos



\*\*Implementación:\*\*

```csharp

// Obtener paso actual

var pasoActual = await \_context.WorkflowBitacoras

&#x20;   .Where(b => b.IdOrden == orden.IdOrden)

&#x20;   .OrderByDescending(b => b.FechaEvento)

&#x20;   .Select(b => b.IdPaso)

&#x20;   .FirstOrDefaultAsync(ct);



// Obtener orden del paso actual

var ordenPasoActual = await \_context.WorkflowPasos

&#x20;   .Where(p => p.IdPaso == pasoActual)

&#x20;   .Select(p => p.Orden)

&#x20;   .FirstOrDefaultAsync(ct);



// Obtener pasos anteriores

var pasosAnteriores = await \_context.WorkflowPasos

&#x20;   .Where(p => p.IdWorkflow == idWorkflow \&\& p.Orden < ordenPasoActual)

&#x20;   .Select(p => p.IdPaso)

&#x20;   .ToListAsync(ct);



// Obtener usuarios de bitácora en pasos anteriores (excluyendo al actual)

var prevApprovers = await \_context.WorkflowBitacoras

&#x20;   .Where(b => b.IdOrden == orden.IdOrden 

&#x20;       \&\& pasosAnteriores.Contains(b.IdPaso)

&#x20;       \&\& b.IdUsuario != idUsuarioActual)

&#x20;   .Select(b => b.IdUsuario)

&#x20;   .Distinct()

&#x20;   .ToListAsync(ct);

```



\*\*Nota:\*\* Se elimina el filtro `TipoAccionCodigo == "APROBAR"` para incluir también quienes devolvieron u otras acciones.



\---



\### 3.4 Exclusiones a Nivel de Participante



\*\*Nueva columna en `WorkflowParticipante`:\*\*

```sql

ALTER TABLE config.workflow\_participantes 

ADD COLUMN recibe\_notificaciones BIT DEFAULT 1;

```



\*\*Comportamiento:\*\*

\- Si `recibe\_notificaciones = false`:

&#x20; - No recibe notificaciones como "siguiente"

&#x20; - No recibe notificaciones como "autorizador previo"

&#x20; - No recibe notificaciones como "paso anterior"

&#x20; - Sí puede ver la orden en sus listados (no afecta permisos)

\- Si `recibe\_notificaciones = true` (default): Comportamiento normal



\*\*Aplicación en `ResolveRecipientsAsync`:\*\*

```csharp

// Después de resolver todos los IDs, filtrar exclusiones

var usuariosExcluidos = await \_context.WorkflowParticipantes

&#x20;   .Where(p => pasosAnteriores.Contains(p.IdPaso) 

&#x20;       \&\& p.RecibeNotificaciones == false 

&#x20;       \&\& p.IdUsuario.HasValue)

&#x20;   .Select(p => p.IdUsuario.Value)

&#x20;   .ToListAsync(ct);



ids.RemoveWhere(id => usuariosExcluidos.Contains(id));

```



\---



\### 3.5 Exclusiones a Nivel de Paso



\*\*Nueva columna en `WorkflowPaso`:\*\*

```sql

ALTER TABLE config.workflow\_pasos

ADD COLUMN notificar\_a\_participantes BIT DEFAULT 1;

```



\*\*Comportamiento:\*\*

\- Si `notificar\_a\_participantes = false`:

&#x20; - Nadie que sea participante de este paso recibe notificaciones automáticas

&#x20; - Las notificaciones "siguiente" y "paso anterior" no envían a nadie de este paso

&#x20; - Útil para pasos informativos o de revisión sin notificaciones

\- Si `notificar\_a\_participantes = true` (default): Comportamiento normal



\*\*Aplicación en `ResolveRecipientsAsync`:\*\*

```csharp

// Obtener pasos con notificaciones desactivadas

var pasosSinNotif = await \_context.WorkflowPasos

&#x20;   .Where(p => p.NotificarAParticipantes == false)

&#x20;   .Select(p => p.IdPaso)

&#x20;   .ToListAsync(ct);



// Si el paso destino tiene notificaciones desactivadas, no enviar a "siguiente"

if (pasosSinNotif.Contains(idPasoDestino))

{

&#x20;   // No agregar participantes del paso destino

}



// Si el paso anterior tiene notificaciones desactivadas, no enviar a "paso anterior"

if (pasosSinNotif.Contains(ultimoPasoAnterior))

{

&#x20;   // No agregar participantes del paso anterior

}

```



\---



\## 4. Estructura de Datos Actualizada



\### 4.1 Tabla `config.workflow\_notificaciones`



| Campo | Tipo | Default | Descripción |

|-------|------|---------|-------------|

| `avisar\_al\_creador` | BIT | 0 | Notificar al creador de la orden |

| `avisar\_al\_anterior` | BIT | 0 | \*\*Renombrar UI:\*\* "Avisar al firmante actual" |

| `avisar\_al\_siguiente` | BIT | 1 | Notificar a participantes del paso destino |

| `avisar\_a\_autorizadores\_previos` | BIT | 0 | Notificar a participantes de pasos anteriores |

| `avisar\_al\_paso\_anterior` | BIT | 0 | \*\*NUEVO:\*\* Notificar al paso del que vino |

| `enviar\_email` | BIT | 1 | Enviar por email |

| `enviar\_telegram` | BIT | 0 | Enviar por Telegram |

| `enviar\_whatsapp` | BIT | 0 | Enviar por WhatsApp |

| `incluir\_partidas` | BIT | 0 | Incluir tabla de partidas en notificación |

| `activo` | BIT | 1 | Notificación activa |



\### 4.2 Tabla `config.workflow\_participantes`



| Campo | Tipo | Default | Descripción |

|-------|------|---------|-------------|

| `id\_participante` | INT | PK | Identificador |

| `id\_paso` | INT | FK | Paso al que pertenece |

| `id\_usuario` | INT | NULL | Usuario específico |

| `id\_rol` | INT | NULL | Rol (si es por rol) |

| `activo` | BIT | 1 | Participante activo |

| `recibe\_notificaciones` | BIT | 1 | \*\*NUEVO:\*\* Recibe notificaciones automáticas |



\### 4.3 Tabla `config.workflow\_pasos`



| Campo | Tipo | Default | Descripción |

|-------|------|---------|-------------|

| `id\_paso` | INT | PK | Identificador |

| `id\_workflow` | INT | FK | Workflow al que pertenece |

| `orden` | INT | - | Orden secuencial en el workflow |

| `nombre\_paso` | NVARCHAR | - | Nombre del paso |

| `activo` | BIT | 1 | Paso activo |

| `notificar\_a\_participantes` | BIT | 1 | \*\*NUEVO:\*\* Los participantes reciben notificaciones |



\---



\## 5. Flujo de Resolución de Destinatarios



\### 5.1 Algoritmo Actualizado



```

1\. Inicializar HashSet<int> ids = vacío



2\. SI avisar\_al\_creador = true

&#x20;  → Agregar orden.IdUsuarioCreador



3\. SI avisar\_al\_anterior = true

&#x20;  → Agregar idUsuarioActual (firmante actual)



4\. SI avisar\_al\_paso\_anterior = true

&#x20;  → Obtener último paso anterior desde bitácora

&#x20;  → SI paso anterior existe Y notificar\_a\_participantes = true

&#x20;     → Obtener participantes del paso anterior

&#x20;     → Agregar usuarios (IdUsuario) y usuarios de roles (IdRol)



5\. SI avisar\_al\_siguiente = true Y participantesDestino.Count > 0

&#x20;  → SI paso destino tiene notificar\_a\_participantes = true

&#x20;     → Para cada participante:

&#x20;        → Si IdUsuario.HasValue Y recibe\_notificaciones = true

&#x20;           → Agregar IdUsuario.Value

&#x20;        → Si IdRol.HasValue

&#x20;           → Obtener usuarios del rol

&#x20;           → Agregar usuarios



6\. SI avisar\_a\_autorizadores\_previos = true

&#x20;  → Obtener paso actual desde bitácora

&#x20;  → Obtener orden del paso actual

&#x20;  → Obtener pasos anteriores (orden < orden actual)

&#x20;  → Obtener usuarios de bitácora en esos pasos

&#x20;  → Excluir idUsuarioActual

&#x20;  → Excluir usuarios con recibe\_notificaciones = false

&#x20;  → Agregar usuarios restantes



7\. Retornar lista de IDs

```



\---



\## 6. Cambios en Frontend



\### 6.1 Configuración de Notificaciones



\*\*Nueva opción en formulario:\*\*

\- Checkbox: "Avisar al paso anterior" (avisar\_al\_paso\_anterior)

\- Label actualizado: "Avisar al firmante actual" (avisar\_al\_anterior)



\### 6.2 Configuración de Participantes



\*\*Nueva columna en tabla:\*\*

\- Checkbox: "Recibe notificaciones" (recibe\_notificaciones)

\- Default: true



\### 6.3 Configuración de Pasos



\*\*Nueva columna en tabla:\*\*

\- Checkbox: "Notificar a participantes" (notificar\_a\_participantes)

\- Default: true



\---



\## 7. Migración de Base de Datos



\### 7.1 Script SQL



```sql

\-- 1. Agregar columna a workflow\_notificaciones

ALTER TABLE config.workflow\_notificaciones 

ADD COLUMN avisar\_al\_paso\_anterior BIT DEFAULT 0;



\-- 2. Agregar columna a workflow\_participantes

ALTER TABLE config.workflow\_participantes 

ADD COLUMN recibe\_notificaciones BIT DEFAULT 1;



\-- 3. Agregar columna a workflow\_pasos

ALTER TABLE config.workflow\_pasos

ADD COLUMN notificar\_a\_participantes BIT DEFAULT 1;



\-- 4. Actualizar registros existentes (opcional)

UPDATE config.workflow\_participantes SET recibe\_notificaciones = 1;

UPDATE config.workflow\_pasos SET notificar\_a\_participantes = 1;

```



\---



\## 8. Tareas de Implementación



\### Fase 1: Backend

1\. \[ ] Actualizar entidades (`WorkflowNotificacion`, `WorkflowParticipante`, `WorkflowPaso`)

2\. \[ ] Actualizar configuraciones EF (Fluent API)

3\. \[ ] Actualizar DTOs (Request/Response)

4\. \[ ] Modificar `ResolveRecipientsAsync` con nueva lógica

5\. \[ ] Actualizar `WorkflowService` (CRUD de notificaciones)

6\. \[ ] Crear script de migración SQL



\### Fase 2: Frontend

7\. \[ ] Actualizar tipos TypeScript

8\. \[ ] Actualizar formulario de notificaciones (nueva opción + renombrar)

9\. \[ ] Actualizar tabla de participantes (nueva columna)

10\. \[ ] Actualizar tabla de pasos (nueva columna)

11\. \[ ] Actualizar labels y textos



\### Fase 3: Testing

12\. \[ ] Probar notificación a paso anterior

13\. \[ ] Probar exclusiones de participantes

14\. \[ ] Probar exclusiones de pasos

15\. \[ ] Probar autorizadores previos mejorado



\---



\## 9. Consideraciones



\### 9.1 Compatibilidad

\- Los cambios son aditivos (nuevas columnas con defaults)

\- No afecta notificaciones existentes (defaults mantienen comportamiento actual)



\### 9.2 Rendimiento

\- Consultas adicionales a `WorkflowPasos` y `WorkflowParticipantes`

\- Índices existentes en `IdPaso` y `IdOrden` deberían ser suficientes



\### 9.3 Rollback

\- Si es necesario, se pueden eliminar las columnas nuevas

\- El código anterior seguiría funcionando (las columnas nuevas tienen defaults)



\---



\## 10. Aprobación



\*\*Estado:\*\* ⏳ Pendiente



\*\*Revisado por:\*\* \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_



\*\*Fecha de aprobación:\*\* \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_



\*\*Comentarios:\*\*



