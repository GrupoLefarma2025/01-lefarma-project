# Pitfalls Research

**Domain:** Sistema de Cuentas por Pagar y Notificaciones
**Researched:** 2026-03-20
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Falta de Aislamiento de Datos Multi-Empresa

**What goes wrong:**
Usuarios de una empresa pueden ver datos de otras empresas del grupo. Un empleado de Asokam accidentalmente ve órdenes de compra de Lefarma. Un contador consolidado filtra por empresa incorrecta y genera reportes mezclados. Peor escenario: datos sensibles de una empresa se exponen a usuarios de otra empresa por error en un JOIN o falta de validación de tenant ID.

**Why it happens:**
- Developers olvidan agregar filtro `WHERE EmpresaId = @CurrentTenant` en queries
- Validación solo a nivel UI, no en backend
- Falta de Row-Level Security en base de datos
- Usar IDs globales en lugar de IDs por tenant (colisiones)
- No validar tenant ID en cada request del middleware

**How to avoid:**
- Implementar Row-Level Security (RLS) en SQL Server para tablas con tenant
- Middleware que inyecte `EmpresaId` en el contexto de cada request y valide su existencia
- Todos los queries deben filtrar por `EmpresaId` explícitamente (no usar asterisco sin WHERE)
- IDs compuestos o UUID con tenant prefix para evitar colisiones
- Tests automatizados que verifiquen que un usuario de Empresa A no pueda acceder a datos de Empresa B

**Warning signs:**
- Queries sin filtro de tenant en code review
- "Funciona en mi máquina" con datos de una empresa pero falla con otra
- Reportes que muestran más registros de los que debería haber para una empresa
- No hay tests de aislamiento de tenant

**Phase to address:**
Fase 1: Sistema de Notificaciones - La arquitectura de aislamiento de datos debe estar desde el inicio, ya que todas las fases dependen de ella.

---

### Pitfall 2: Sistema de Notificaciones que Spam o Falla Silenciosamente

**What goes wrong:**
Usuarios reciben 50 notificaciones del mismo evento (spam) o 0 notificaciones de eventos críticos (timeout). Peor escenario: notificaciones de aprobación de pago nunca llegan, el proveedor no cobra, el sistema opera como si todo estuviera bien. Timeout de SMTP bloquea el thread y no hay reintentos. Telegram API falla y no hay dead letter queue.

**Why it happens:**
- Intentar enviar notificaciones sincrónicamente dentro del request principal
- No implementar reintentos con exponential backoff
- Falta de deduplicación de eventos (mismo evento se procesa múltiples veces)
- No tener circuit breaker cuando servicios externos (SMTP, Telegram) fallan
- Enviar notificaciones duplicadas por cada retry en lugar de por evento único
- No validar delivery status (email enviado pero cayó en spam)

**How to avoid:**
- Arquitectura asíncrona: publicar evento en message queue (RabbitMQ/Service Bus) inmediatamente
- Procesador de notificaciones background con idempotencia (usar correlation ID)
- Dead letter queue para notificaciones fallidas + monitor de alertas
- Rate limiting por usuario canal (ej: máx 5 notificaciones/hora por canal)
- Circuit breaker para servicios externos (SMTP, Telegram API)
- Persistir estado de delivery (pending, sent, failed, bounced) para cada notificación
- Preferencia de usuario: qué canales quiere para cada tipo de evento

**Warning signs:**
- Tiempo de respuesta de API aumenta cuando hay notificaciones
- Duplicados en logs de notificaciones para el mismo evento
- No hay logs de failed deliveries
- Tests de notificación marcan verde pero en producción no llegan
- No hay dashboards de delivery rate por canal

**Phase to address:**
Fase 1: Sistema de Notificaciones - Es el core de esta fase. Sin arquitectura correcta, el módulo será inestable.

---

### Pitfall 3: Over-Permissioning y Escalada de Privilegios

**What goes wrong:**
Un empleado de sucursal X puede autorizar gastos de sucursal Y. Un gerente puede aprobar sus propios gastos. Un usuario sin rol de contador puede ver reportes consolidados de todas las empresas. Peor escenario: un usuario malintencionado se auto-asigna rol de administrador y aprueba órdenes de compra falsas.

**Why it happens:**
- Validación solo en frontend (fácil de bypass)
- No verificar que el usuario tenga permiso específico para LA empresa/sucursal específica
- No validar que el aprobador sea diferente del solicitante
- Roles muy generales ("Autorizador") sin especificar alcance (empresa/sucursal/monto)
- No verificar jerarquía (un gerente de área no puede aprobar gastos del director)

**How to avoid:**
- Role-Based Access Control (RBAC) con scoping: `EmpresaId + SucursalId + Rol`
- Policy-based authorization en backend para cada operación (ej: `CanApproveExpensePolicy`)
- Validar que aprobador ≠ solicitante en el motor de reglas
- Checks de self-approval prevention en backend, no solo en UI
- Auditoría de cambios de roles (quién asignó qué rol a quién y cuándo)
- Principio de mínimo privilegio: roles específicos no genéricos

**Warning signs:**
- Frontend oculta botones pero backend endpoint es accesible para todos
- "Para probar rápido" se comenta validación y nunca se恢复了
- No hay tests de autorización con usuarios de diferentes roles
- Cambios de rol no se auditan

**Phase to address:**
Fase 1: Sistema de Notificaciones - La base de permisos debe estar definida desde el inicio, ya que todas las fases la usarán.

---

### Pitfall 4: Acoplamiento Excesivo con Motor de Flujos Externo

**What goes wrong:**
El sistema depende completamente de la API del motor de flujos del compañero. Si esa API cambia, todo el sistema se rompe. Si el motor de flujos está caído, nadie puede ver ni crear órdenes de compra. Peor escenario: el compañero cambia su esquema de autenticación o renombra campos y el sistema deja de funcionar sin un contract layer que aísle el cambio.

**Why it happens:**
- Llamar directamente a la API externa desde múltiples puntos del código (acoplamiento distribuido)
- No tener una capa de abstracción/adapter que encapsule la integración
- No versionar el contract con el motor de flujos
- Assumptions sobre comportamiento del motor que cambian sin aviso
- No tener un mock/stub para desarrollo independiente

**How to avoid:**
- Implementar Anti-Corruption Layer: adapter que traduce nuestro modelo ↔ modelo del motor de flujos
- Interface local `IWorkflowService` que nuestra aplicación usa, implementación concreta llama API externa
- Versionar el contract (v1, v2) y soportar al menos 2 versiones simultáneas
- Usar DTOs propios, no exponer entidades del motor de flujos a nuestro dominio
- Tener mock implementation para desarrollo y tests sin depender del servicio externo
- Circuit breaker + fallback: si el motor de flujos cae, permitir operaciones de lectura al menos
- Logs detallados de request/response al motor para debugging

**Warning signs:**
- Código de nuestro dominio tiene referencias a clases/namespaces del motor de flujos
- Cambios en el motor requieren cambios en múltiples archivos de nuestro código
- No se puede correr el sistema local sin conexión al motor de flujos
- No hay tests unitarios que mockeen el motor

**Phase to address:**
Fase 2: Captura de Órdenes de Compra + Flujo de Autorizaciones - Es cuando se integra con el motor. Prevenir acoplamiento desde el día 1.

---

### Pitfall 5: Validación Débil de Comprobaciones (XML/CFDI)

**What goes wrong:**
Se aceptan XMLs inválidos, duplicados o alterados. Un proveedor envía el mismo XML dos veces y se paga dos veces. Un XML modificado manualmente pasa validación pero el SAT lo rechaza después. Peor escenario: fraude con XMLs falsos o de terceros, el sistema no valida que el UUID del CFDI no haya sido usado previamente, se pagan gastos con comprobantes de otras empresas.

**Why it happens:**
- Validar solo formato XML, no estructura del CFDI
- No verificar UUID único contra SAT (cancelación, duplicados)
- No validar que el XML pertenezca al proveedor correcto (RFC del emisor)
- No validar monto total contra suma de partidas
- No verificar sello digital del SAT (cadena original + certificado)
- No validar que el XML no esté cancelado en el SAT
- Permitir subir XMLs de cualquier empresa sin validar que coincida con empresa del gasto

**How to avoid:**
- Integración con servicio de validación CFDI del SAT (Web Service o librería certificada)
- Validar UUID único en base de datos local + check contra SAT
- Verificar RFC del emisor coincide con proveedor registrado
- Validar monto total = suma de conceptos + impuestos
- Verificar sello SAT (usar librería como `cfdiutils` o servicio externo)
- Check de estatus CFDI (vigente, cancelado) al momento de cargar
- Prevenir duplicados: misma combinación UUID + RFC Emisor + Monto Total
- Almacenar XML original firmado para auditoría futura

**Warning signs:**
- Validación solo verifica que el archivo sea XML bien formado
- No hay logs de validaciones contra SAT
- Tests no incluyen XMLs maliciosos o edge cases
- No se almacena XML original, solo datos extraídos

**Phase to address:**
Fase 3: Tesorería y Programación de Pagos - Es cuando se requiere comprobación para pagar. Sin validación robusta, el sistema es vulnerable a fraude.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode reglas de notificación en código | Rápido de implementar | Cada cambio requiere deploy | Nunca - usar configuración parametrizable en DB |
| Validación solo en frontend | Desarrollo más rápido | Vulnerabilidad de seguridad | Nunca - siempre validar en backend |
| Sincronizar llamadas al motor de flujos | Simplicidad inicial | Performance degrada, acoplamiento | Solo en MVP prototipo, nunca en producción |
| No implementar reintentos en notificaciones | Código simple | Notificaciones se pierden silenciosamente | Nunca - las notificaciones son críticas |
| Usar strings para roles/permisos | Fácil de empezar | Difficult evolution, typos causan bugs | Aceptable temporalmente, migrar a enum/constantes |
| Omitir tests de aislamiento de tenant | Velocidad | Data leaks, costoso corregir después | Nunca - esencial desde el inicio |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SMTP (Email) | Enviar email sync dentro del request HTTP | Enqueue en background queue, procesar async |
| Telegram Bot API | No manejar rate limits (429 Too Many Requests) | Implementar exponential backoff + retry |
| Motor de flujos (compañero) | Acoplar código del dominio a DTOs del motor | Anti-Corruption Layer con DTOs propios |
| SAT CFDI Validation | Validar solo estructura XML, no contra SAT | Consultar servicio del SAT para UUID vigente |
| Catálogos corporativos existentes | Assumptions sobre IDs que cambian | Versionar contracts y validar schema al inicio |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries en notificaciones por usuario | Tiempo de respuesta > 5s con 100 usuarios | Eager loading o batch queries para cargar preferencias | ~50-100 usuarios con múltiples notificaciones |
| No paginar listas de órdenes de compra | Timeout al cargar "todas las órdenes" | Paginación obligatoria en endpoints de listas | ~500+ registros en una tabla |
| Missing index en EmpresaId | Queries lentos cuando hay data de múltiples empresas | Índices compuestos (EmpresaId, Fecha, Estatus) en todas las tablas multi-tenant | ~10K+ registros |
| Sincronizar llamadas a APIs externas | Una llamada lenta bloquea todo el sistema | Timeouts apropiados + async/await + circuit breaker | Desde el primer día si hay latencia > 100ms |
| No cachear catálogos corporativos | Consultar catálogos en cada request | Cachear en memoria o Redis con invalidación | ~100 requests/segundo |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Permitir self-approval (aprobar propio gasto) | Fraude interno, conflicto de interés | Validar en backend que aprobador ≠ solicitante |
| No validar monto máximo de aprobación por rol | Aprobaciones excesivas sin autorización | Policy que verifique monto contra límites del rol del aprobador |
| Exponer todos los datos en reportes consolidados | Data leakage entre empresas | Scope de permisos a nivel empresa/sucursal siempre |
| No auditar cambios de roles y permisos | Privilege escalation no detectado | Log every role change with who/when/why |
| URLs con IDs predecibles (ej: /ordenes/123) | Enumeration attack, adivinar otros recursos | Use UUIDs o validar acceso a cada recurso |
| No validar tenant ID en cada request | Cross-tenant data access | Middleware que valide tenant en context y pertenezca al usuario |
| Almacenar datos sensibles en logs | Exposición de información fiscal | Redactar RFCs, montos, UUIDs en logs |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No distinguir canales de notificación en UI | Usuario no sabe si recibirá alerta por email, Telegram o in-app | Mostrar preferencias actuales y permitir cambio por evento |
| No indicar estado de delivery de notificación | Usuario asume que "el sistema no avisó" cuando el correo cayó en spam | Mostrar icono de estado (enviado, leído, falló, reintentando) |
| No permitir reenvío de notificaciones | Usuario perdió el correo y no tiene link de aprobación | Botón "Reenviar notificación" con cooldown de 5 minutos |
| Listas interminables sin filtros | Difícil encontrar la orden de compra específica | Filtros obligatorios: fecha, estatus, empresa, proveedor, monto |
| No mostrar historial de aprobaciones | Usuario no sabe quién aprobó y cuándo | Timeline vertical con avatar, nombre, fecha, comentario |
| No permitir búsqueda por RFC o UUID de CFDI | Contadores no pueden encontrar comprobantes específicos | Búsqueda global que indexe RFCs y UUIDs |
| Errores criptográficos (ej: "Error 500") | Usuario no sabe qué salió mal | Mensajes amigables: "El servicio de notificaciones no está disponible, reintentando en 5 minutos" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Sistema de notificaciones:** Often missing dead letter queue + monitor — verify que las notificaciones fallidas se puedan reintentar manualmente y haya dashboards de delivery rate
- [ ] **Multi-empresa:** Often missing validación de tenant en todos los endpoints — verify que no haya endpoints sin filtro de empresa
- [ ] **Workflow integration:** Often missing circuit breaker — verify que el sistema funcione aunque el motor de flujos esté caído (lectura al menos)
- [ ] **Comprobación de gastos:** Often missing validación contra SAT — verify que UUIDs se validen en tiempo real contra el servicio del SAT
- [ ] **Roles y permisos:** Often missing tests de autorización — verify que existan tests que intenten acceder sin permiso
- [ ] **Reportes:** Often missing cache para reportes pesados — verify que reportes consolidados no se generen en tiempo real sin cache

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Data leak entre empresas | HIGH | 1) Auditoría inmediata de quién vio qué, 2) Implementar RLS, 3) Re-autenticar todos los usuarios, 4) Notificar stakeholders afectados |
| Spam masivo de notificaciones | MEDIUM | 1) Apagar sistema de notificaciones, 2) Limpiar colas de mensajes, 3) Implementar rate limiting, 4) Re-enviar solo notificaciones críticas |
| Acoplamiento con motor de flujos | HIGH | 1) Crear adapter layer, 2) Migrar gradualmente todas las llamadas directas al adapter, 3) Versionar contract, 4) Agregar tests de integración |
| XMLs duplicados pagados | HIGH | 1) Identificar duplicados por UUID, 2) Contactar proveedores para reversos, 3) Implementar validación de UUID único, 4) Auditar todos los pagos del último mes |
| Roles mal configurados | MEDIUM | 1) Revertir a roles conocidos buenos (backup), 2) Re-aplicar permisos con scripts auditados, 3) Forzar re-login de todos los usuarios |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Falta de aislamiento de datos multi-empresa | Fase 1: Sistema de Notificaciones | Tests de integración que verifiquen cross-tenant access es bloqueado |
| Sistema de notificaciones spam/falla | Fase 1: Sistema de Notificaciones | Tests de carga + simulación de fallos en SMTP/Telegram + medición de delivery rate |
| Over-permissioning y escalada de privilegios | Fase 1: Sistema de Notificaciones | Tests de seguridad que intentan bypass de autorización con diferentes roles |
| Acoplamiento con motor de flujos | Fase 2: Captura de Órdenes + Flujo de Autorizaciones | Tests de integración con mock del motor + verify adapter layer existe |
| Validación débil de comprobaciones XML | Fase 3: Tesorería y Programación de Pagos | Tests con XMLs maliciosos, duplicados, cancelados + verify validación SAT |
| Performance traps (N+1, missing indexes) | Todas las fases - continuous | Profiler en cada fase + load tests antes de release |
| UX pitfalls (falta de filtros, historial) | Fase 2: Captura de Órdenes + Reportes | Usability testing con usuarios reales del grupo Lefarma |

---

## Sources

- **Training Knowledge**: Patterns of distributed systems (Martin Fowler) - reliable messaging patterns
- **Training Knowledge**: Multi-tenant SaaS security best practices
- **Training Knowledge**: Accounts payable automation common implementation mistakes
- **Training Knowledge**: CFDI/SAT validation requirements for Mexican tax compliance
- **Training Knowledge**: Role-based access control patterns in enterprise applications
- **Martin Fowler Patterns**: Idempotent Receiver, Circuit Breaker, Anti-Corruption Layer
- **Domain Knowledge**: SAT CFDI validation requirements (UUID uniqueness, cancellation check)
- **Context**: Grupo Lefarma project requirements (multi-empresa, roles granulares, integración motor de flujos)

**Confidence Assessment:**
- **HIGH**: Multi-tenant data isolation patterns, notification system architecture, RBAC best practices
- **MEDIUM**: SAT CFDI validation specifics (mexican tax authority requirements), motor de flujos integration (no specs yet)
- **LOW**: Specific implementation details of external workflow engine (company's partner system not yet documented)

**Note:** Due to technical issues with web search tools during research session, this document relies primarily on established software architecture patterns, multi-tenant SaaS best practices, and domain knowledge of accounts payable systems. Phase-specific research may be needed for:
1. Exact SAT CFDI validation service specifications
2. Workflow engine API contract and versioning strategy
3. Specific SMTP provider rate limits and retry policies
4. Telegram Bot API specific constraints for Mexico

---

*Pitfalls research for: Sistema de Cuentas por Pagar y Notificaciones*
*Researched: 2026-03-20*
