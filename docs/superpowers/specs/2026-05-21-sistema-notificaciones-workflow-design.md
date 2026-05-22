# Plan de Mejoras al Sistema de Notificaciones de Workflow

## Fecha: 2026-05-21
## Estado: Pendiente de aprobación

---

## 1. Resumen Ejecutivo

El sistema actual de notificaciones del workflow tiene limitaciones en la precisión de los destinatarios:
- "Autorizadores previos" consulta la bitácora sin distinguir pasos del workflow
- No existe la opción de notificar al "paso anterior" (del que vino la orden)
- No hay forma de excluir participantes específicos o pasos completos de las notificaciones

Este plan propone mejorar la precisión y flexibilidad del sistema de notificaciones.

---

## 2. Problemas Actuales

### 2.1 "Avisar al Anterior" es confuso
- Actualmente significa "notificar al firmante actual" (quien ejecutó la acción)
- El nombre genera confusión con "paso anterior"

### 2.2 "Autorizadores Previos" usa bitácora crudamente
- Consulta TODOS los registros de bitácora con acción "APROBAR"
- No distingue entre pasos del workflow
- Incluye al usuario actual si previamente aprobó
- No respeta la estructura secuencial del workflow

### 2.3 Falta "Avisar al Paso Anterior"
- No hay forma de notificar específicamente al paso del que vino la orden
- Útil cuando una orden regresa o avanza y se necesita informar al paso anterior

### 2.4 No hay exclusiones de notificaciones
- No se puede marcar un participante para que no reciba notificaciones
- No se puede desactivar notificaciones a nivel de paso

---

## 3. Mejoras Propuestas

### 3.1 Renombrar "Avisar al Anterior" → "Avisar al Firmante Actual"

**Cambio:**
- Label en UI: "Avisar al firmante actual" (en lugar de "Avisar al anterior")
- Comportamiento: Sin cambios, notifica al `idUsuarioActual` que ejecutó la acción
- Campo en BD: `avisar_al_anterior` (sin cambio de nombre para evitar migración)

**Motivación:** Claridad semántica. El usuario que firma es el "firmante actual", no el "anterior".

**Variable de Template:**
- Actualmente existe `NombreAnterior` que en realidad es el firmante actual
- **Nueva variable:** `NombreFirmanteActual` = nombre del usuario que ejecutó la acción
- **Corregir:** `NombreAnterior` debe ser el nombre del paso anterior (cuando aplique)

---

### 3.2 Nueva Opción: "Avisar al Paso Anterior"

**Comportamiento:**
- Notifica a los participantes del paso del que vino la orden
- Se determina consultando la bitácora: último `IdPaso` registrado antes del paso actual
- Incluye usuarios directos (`IdUsuario`) y usuarios de roles (`IdRol`) de ese paso

**Variable de Template:**
- `NombreFirmanteActual` = nombre del usuario que ejecutó la acción (nueva variable)
- `NombreAnterior` = nombre del usuario del paso anterior (obtenido de participantes o bitácora)
- Esto corrige el uso actual donde `NombreAnterior` en realidad es el firmante actual

**Implementación de Variables:**
```csharp
// Nombre del firmante actual (quien ejecutó la acción)
var nombreActual = await _asokamContext.Usuarios
    .Where(u => u.IdUsuario == idUsuarioActual)
    .Select(u => u.NombreCompleto)
    .FirstOrDefaultAsync(ct) ?? "el usuario";

// Nombre del paso anterior (si aplica)
var nombreAnterior = "el paso anterior";
if (notif.AvisarAlPasoAnterior)
{
    var ultimoPasoAnterior = await _context.WorkflowBitacoras
        .Where(b => b.IdOrden == orden.IdOrden && b.IdPaso != pasoActual.IdPaso)
        .OrderByDescending(b => b.FechaEvento)
        .Select(b => b.IdPaso)
        .FirstOrDefaultAsync(ct);
    
    var participanteAnterior = await _context.WorkflowParticipantes
        .Where(p => p.IdPaso == ultimoPasoAnterior && p.Activo && p.IdUsuario.HasValue)
        .FirstOrDefaultAsync(ct);
    
    if (participanteAnterior != null)
    {
        var nombre = await _asokamContext.Usuarios
            .Where(u => u.IdUsuario == participanteAnterior.IdUsuario.Value)
            .Select(u => u.NombreCompleto)
            .FirstOrDefaultAsync(ct);
        if (!string.IsNullOrEmpty(nombre))
            nombreAnterior = nombre;
    }
}

// En el contexto del template:
contextoTemplate["NombreFirmanteActual"] = nombreActual;
contextoTemplate["NombreAnterior"] = nombreAnterior;
contextoTemplate["Usuario"] = nombreActual;
```

**Implementación:**
```csharp
// Consultar último paso anterior desde bitácora
var ultimoPasoAnterior = await _context.WorkflowBitacoras
    .Where(b => b.IdOrden == orden.IdOrden && b.IdPaso != pasoActual.IdPaso)
    .OrderByDescending(b => b.FechaEvento)
    .Select(b => b.IdPaso)
    .FirstOrDefaultAsync(ct);

// Obtener participantes de ese paso
var participantesPasoAnterior = await _context.WorkflowParticipantes
    .Where(p => p.IdPaso == ultimoPasoAnterior && p.Activo)
    .ToListAsync(ct);

// Resolver nombre del paso anterior
var nombreAnterior = "el paso anterior";
var participanteAnterior = participantesPasoAnterior.FirstOrDefault();
if (participanteAnterior?.IdUsuario.HasValue == true)
{
    var nombre = await _asokamContext.Usuarios
        .Where(u => u.IdUsuario == participanteAnterior.IdUsuario.Value)
        .Select(u => u.NombreCompleto)
        .FirstOrDefaultAsync(ct);
    if (!string.IsNullOrEmpty(nombre))
        nombreAnterior = nombre;
}
```

**Campo en BD:**
```sql
ALTER TABLE config.workflow_notificaciones 
ADD COLUMN avisar_al_paso_anterior BIT DEFAULT 0;
```

---

### 3.3 Mejorar "Avisar a Autorizadores Previos"

**Comportamiento actual (PROBLEMA):**
- Consulta bitácora filtrando por `TipoAccionCodigo == "APROBAR"`
- No distingue en qué paso aprobaron
- Incluye al usuario actual

**Nuevo comportamiento:**
1. Obtener el paso actual de la orden
2. Obtener todos los pasos anteriores en el workflow (por campo `Orden`)
3. Consultar bitácora filtrando:
   - `IdOrden == orden.IdOrden`
   - `IdPaso` está en la lista de pasos anteriores
   - `IdUsuario != idUsuarioActual` (excluir al actual)
4. Obtener usuarios distintos que participaron en esos pasos

**Implementación:**
```csharp
// Obtener paso actual
var pasoActual = await _context.WorkflowBitacoras
    .Where(b => b.IdOrden == orden.IdOrden)
    .OrderByDescending(b => b.FechaEvento)
    .Select(b => b.IdPaso)
    .FirstOrDefaultAsync(ct);

// Obtener orden del paso actual
var ordenPasoActual = await _context.WorkflowPasos
    .Where(p => p.IdPaso == pasoActual)
    .Select(p => p.Orden)
    .FirstOrDefaultAsync(ct);

// Obtener pasos anteriores
var pasosAnteriores = await _context.WorkflowPasos
    .Where(p => p.IdWorkflow == idWorkflow && p.Orden < ordenPasoActual)
    .Select(p => p.IdPaso)
    .ToListAsync(ct);

// Obtener usuarios de bitácora en pasos anteriores (excluyendo al actual)
var prevApprovers = await _context.WorkflowBitacoras
    .Where(b => b.IdOrden == orden.IdOrden 
        && pasosAnteriores.Contains(b.IdPaso)
        && b.IdUsuario != idUsuarioActual)
    .Select(b => b.IdUsuario)
    .Distinct()
    .ToListAsync(ct);
```

**Nota:** Se elimina el filtro `TipoAccionCodigo == "APROBAR"` para incluir también quienes devolvieron u otras acciones.

---

### 3.4 Exclusiones a Nivel de Participante

**Nueva columna en `WorkflowParticipante`:**
```sql
ALTER TABLE config.workflow_participantes 
ADD COLUMN recibe_notificaciones BIT DEFAULT 1;
```

**Comportamiento:**
- Si `recibe_notificaciones = false`:
  - No recibe notificaciones como "siguiente"
  - No recibe notificaciones como "autorizador previo"
  - No recibe notificaciones como "paso anterior"
  - Sí puede ver la orden en sus listados (no afecta permisos)
- Si `recibe_notificaciones = true` (default): Comportamiento normal

**Aplicación en `ResolveRecipientsAsync`:**
```csharp
// Después de resolver todos los IDs, filtrar exclusiones
var usuariosExcluidos = await _context.WorkflowParticipantes
    .Where(p => pasosAnteriores.Contains(p.IdPaso) 
        && p.RecibeNotificaciones == false 
        && p.IdUsuario.HasValue)
    .Select(p => p.IdUsuario.Value)
    .ToListAsync(ct);

ids.RemoveWhere(id => usuariosExcluidos.Contains(id));
```

---

### 3.5 Exclusiones a Nivel de Paso

**Nueva columna en `WorkflowPaso`:**
```sql
ALTER TABLE config.workflow_pasos
ADD COLUMN notificar_a_participantes BIT DEFAULT 1;
```

**Comportamiento:**
- Si `notificar_a_participantes = false`:
  - Nadie que sea participante de este paso recibe notificaciones automáticas
  - Las notificaciones "siguiente" y "paso anterior" no envían a nadie de este paso
  - Útil para pasos informativos o de revisión sin notificaciones
- Si `notificar_a_participantes = true` (default): Comportamiento normal

**Aplicación en `ResolveRecipientsAsync`:**
```csharp
// Obtener pasos con notificaciones desactivadas
var pasosSinNotif = await _context.WorkflowPasos
    .Where(p => p.NotificarAParticipantes == false)
    .Select(p => p.IdPaso)
    .ToListAsync(ct);

// Si el paso destino tiene notificaciones desactivadas, no enviar a "siguiente"
if (pasosSinNotif.Contains(idPasoDestino))
{
    // No agregar participantes del paso destino
}

// Si el paso anterior tiene notificaciones desactivadas, no enviar a "paso anterior"
if (pasosSinNotif.Contains(ultimoPasoAnterior))
{
    // No agregar participantes del paso anterior
}
```

---

## 4. Estructura de Datos Actualizada

### 4.1 Tabla `config.workflow_notificaciones`

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `avisar_al_creador` | BIT | 0 | Notificar al creador de la orden |
| `avisar_al_anterior` | BIT | 0 | **Renombrar UI:** "Avisar al firmante actual" |
| `avisar_al_siguiente` | BIT | 1 | Notificar a participantes del paso destino |
| `avisar_a_autorizadores_previos` | BIT | 0 | Notificar a participantes de pasos anteriores |
| `avisar_al_paso_anterior` | BIT | 0 | **NUEVO:** Notificar al paso del que vino |
| `enviar_email` | BIT | 1 | Enviar por email |
| `enviar_telegram` | BIT | 0 | Enviar por Telegram |
| `enviar_whatsapp` | BIT | 0 | Enviar por WhatsApp |
| `incluir_partidas` | BIT | 0 | Incluir tabla de partidas en notificación |
| `activo` | BIT | 1 | Notificación activa |

### 4.2 Tabla `config.workflow_participantes`

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `id_participante` | INT | PK | Identificador |
| `id_paso` | INT | FK | Paso al que pertenece |
| `id_usuario` | INT | NULL | Usuario específico |
| `id_rol` | INT | NULL | Rol (si es por rol) |
| `activo` | BIT | 1 | Participante activo |
| `recibe_notificaciones` | BIT | 1 | **NUEVO:** Recibe notificaciones automáticas |

### 4.3 Tabla `config.workflow_pasos`

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `id_paso` | INT | PK | Identificador |
| `id_workflow` | INT | FK | Workflow al que pertenece |
| `orden` | INT | - | Orden secuencial en el workflow |
| `nombre_paso` | NVARCHAR | - | Nombre del paso |
| `activo` | BIT | 1 | Paso activo |
| `notificar_a_participantes` | BIT | 1 | **NUEVO:** Los participantes reciben notificaciones |

---

## 5. Flujo de Resolución de Destinatarios

### 5.1 Algoritmo Actualizado

```
1. Inicializar HashSet<int> ids = vacío

2. SI avisar_al_creador = true
   → Agregar orden.IdUsuarioCreador

3. SI avisar_al_anterior = true
   → Agregar idUsuarioActual (firmante actual)

4. SI avisar_al_paso_anterior = true
   → Obtener último paso anterior desde bitácora
   → SI paso anterior existe Y notificar_a_participantes = true
      → Obtener participantes del paso anterior
      → Agregar usuarios (IdUsuario) y usuarios de roles (IdRol)

5. SI avisar_al_siguiente = true Y participantesDestino.Count > 0
   → SI paso destino tiene notificar_a_participantes = true
      → Para cada participante:
         → Si IdUsuario.HasValue Y recibe_notificaciones = true
            → Agregar IdUsuario.Value
         → Si IdRol.HasValue
            → Obtener usuarios del rol
            → Agregar usuarios

6. SI avisar_a_autorizadores_previos = true
   → Obtener paso actual desde bitácora
   → Obtener orden del paso actual
   → Obtener pasos anteriores (orden < orden actual)
   → Obtener usuarios de bitácora en esos pasos
   → Excluir idUsuarioActual
   → Excluir usuarios con recibe_notificaciones = false
   → Agregar usuarios restantes

7. Retornar lista de IDs
```

---

## 6. Cambios en Frontend

### 6.1 Configuración de Notificaciones

**Nueva opción en formulario:**
- Checkbox: "Avisar al paso anterior" (avisar_al_paso_anterior)
- Label actualizado: "Avisar al firmante actual" (avisar_al_anterior)

### 6.2 Configuración de Participantes

**Nueva columna en tabla:**
- Checkbox: "Recibe notificaciones" (recibe_notificaciones)
- Default: true

### 6.3 Configuración de Pasos

**Nueva columna en tabla:**
- Checkbox: "Notificar a participantes" (notificar_a_participantes)
- Default: true

---

## 7. Migración de Base de Datos

### 7.1 Script SQL

```sql
-- 1. Agregar columna a workflow_notificaciones
ALTER TABLE config.workflow_notificaciones 
ADD COLUMN avisar_al_paso_anterior BIT DEFAULT 0;

-- 2. Agregar columna a workflow_participantes
ALTER TABLE config.workflow_participantes 
ADD COLUMN recibe_notificaciones BIT DEFAULT 1;

-- 3. Agregar columna a workflow_pasos
ALTER TABLE config.workflow_pasos
ADD COLUMN notificar_a_participantes BIT DEFAULT 1;

-- 4. Actualizar registros existentes (opcional)
UPDATE config.workflow_participantes SET recibe_notificaciones = 1;
UPDATE config.workflow_pasos SET notificar_a_participantes = 1;
```

---

## 8. Tareas de Implementación

### Fase 1: Backend
1. [ ] Actualizar entidades (`WorkflowNotificacion`, `WorkflowParticipante`, `WorkflowPaso`)
2. [ ] Actualizar configuraciones EF (Fluent API)
3. [ ] Actualizar DTOs (Request/Response)
4. [ ] Modificar `ResolveRecipientsAsync` con nueva lógica
5. [ ] Actualizar `WorkflowService` (CRUD de notificaciones)
6. [ ] Crear script de migración SQL

### Fase 2: Frontend
7. [ ] Actualizar tipos TypeScript
8. [ ] Actualizar formulario de notificaciones (nueva opción + renombrar)
9. [ ] Actualizar tabla de participantes (nueva columna)
10. [ ] Actualizar tabla de pasos (nueva columna)
11. [ ] Actualizar labels y textos

### Fase 3: Testing
12. [ ] Probar notificación a paso anterior
13. [ ] Probar exclusiones de participantes
14. [ ] Probar exclusiones de pasos
15. [ ] Probar autorizadores previos mejorado

---

## 9. Consideraciones

### 9.1 Compatibilidad
- Los cambios son aditivos (nuevas columnas con defaults)
- No afecta notificaciones existentes (defaults mantienen comportamiento actual)

### 9.2 Rendimiento
- Consultas adicionales a `WorkflowPasos` y `WorkflowParticipantes`
- Índices existentes en `IdPaso` y `IdOrden` deberían ser suficientes

### 9.3 Rollback
- Si es necesario, se pueden eliminar las columnas nuevas
- El código anterior seguiría funcionando (las columnas nuevas tienen defaults)

---

## 10. Aprobación

**Estado:** ⏳ Pendiente

**Revisado por:** _______________

**Fecha de aprobación:** _______________

**Comentarios:**

