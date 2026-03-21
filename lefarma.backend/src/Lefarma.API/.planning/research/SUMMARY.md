# Research Summary: Sistema de Cuentas por Pagar - Grupo Lefarma

**Research Date:** 2026-03-20
**Overall Confidence:** MEDIUM-HIGH
**Status:** Complete ✓

---

## Executive Summary

Investigación completa del ecosistema para un sistema de Cuentas por Pagar con notificaciones multi-canal (In-app + Email + Telegram). **Confianza alta en stack técnico y patrones de arquitectura**. **Confianza media en algunas áreas específicas que requieren validación de fase**.

**Recomendación principal:** Proceed con architecture propuesta (Clean Architecture + Policy-based Auth + Notification Strategy Pattern). **Phase-specific research requerido para:** 1) SAT CFDI validation specs, 2) External workflow engine API contract, 3) Telegram Bot API best practices for Mexico.

---

## Key Findings by Dimension

### 1. Stack Tecnológico (HIGH Confidence)

**✅ Recomendaciones verificadas:**

| Componente | Libreria/Paquete | Versión | Confianza |
|------------|-----------------|---------|-----------|
| **Email** | MailKit | 4.13.0+ | HIGH - Verificado en NuGet |
| **Telegram** | Telegram.Bot | 22.7.2+ | HIGH - Verificado en GitHub/NuGet |
| **Autorización** | ASP.NET Core Policy-based Auth | Built-in | HIGH - Verificado en Microsoft Learn |
| **In-App Notifications** | react-hot-toast | 2.6.0+ | HIGH - Verificado en npm |
| **Backend** | .NET 10 + EF Core + SQL Server | - | MEDIUM - .NET 10 puede estar en preview |

**⚠️ Riesgos identificados:**
- **.NET 10 availability:** Puede estar en preview (GA estimado Nov 2025). **Mitigation:** Usar .NET 9 para inicio, migrar a .NET 10 cuando GA.
- **Elsa Workflows:** Documentación retornó 404. **Mitigation:** Plan B es n8n o workflow engine custom en .NET.

**❌ Evitar:**
- **FluentEmail:** No encontrado en NuGet (404), probablemente deprecado.
- **System.Net.Mail:** Deprecado en .NET Core+, usar MailKit.

---

### 2. Features (MEDIUM-HIGH Confidence)

**Table Stakes (Usuarios esperan esto):**
- Approval workflows (motor externo maneja esto)
- RBAC granular (Empresa + Sucursal + Rol)
- Audit trail (crítico para compliance)
- Multi-company support (5 empresas del grupo)
- Email notifications
- Document attachment (XML/PDF)
- Basic reporting

**Diferenciadores clave (Ventaja competitiva):**
- **Sistema de notificaciones parametrizable 3-canal** (In-app + Email + Telegram) ← Primary differentiator
- Workflow dynamic routing (motor externo + integración)
- Multi-company granular permissions (contadores ven todo, empleados solo lo suyo)
- SAT-compliant expense verification (XML/CDFI validation)
- Mobile approvals via Telegram

**Anti-Features (Explicitly NOT building):**
- Real-time dashboard updates (use refresh-on-demand)
- Custom workflow builder (usar motor externo)
- Full accounting system (exportar pólizas, no rebuild)
- Automatic bank reconciliation (fase futura)
- Unlimited notification customization (predefined event types)

**Dependencies identified:**
```
Multi-Company Data Model → Granular RBAC → Notification Engine → Workflow Integration
```

**MVP Definition (v1 - Sistema de Notificaciones):**
- User Management + Multi-Company Roles
- Event System (domain events)
- 3-Channel Notification Engine (Email + Telegram + In-App)
- User Notification Preferences
- External Motor Integration (Read-Only)
- Basic Dashboard + Audit Trail

---

### 3. Architecture (HIGH Confidence)

**Recomendación: Clean Architecture con Dependency Inversion**

```
Presentation (React) → API (ASP.NET Core) → Application (Services) → Domain (Entities) ← Infrastructure (Implementations)
```

**Patrones críticos:**

1. **Policy-Based Multi-Tenant Authorization**
   - Custom `IAuthorizationRequirement` por operación
   - Handlers validan: TenantId + CompanyId + BranchId + Permission
   - Evita role checks en controllers (no escala para multi-tenant)

2. **Notification Provider Strategy Pattern**
   - `INotificationProvider` interface con 3 implementaciones (Email, Telegram, InApp)
   - Background queue (in-memory → RabbitMQ) para non-blocking delivery
   - User preferences determinan canales por evento

3. **External Workflow Adapter Pattern**
   - `IWorkflowClient` interface abstrae API del compañero
   - `WorkflowAdapter` mapea Domain Entities ↔ External DTOs
   - Previene acoplamiento distribuido

**Estructura de proyecto recomendada:**
```
src/
├── Domain/           # Core business logic (no dependencies)
├── Application/      # Use cases orchestration
├── Infrastructure/   # External concerns (EF Core, SMTP, Telegram)
└── API/              # Controllers (thin)
```

**Scaling roadmap:**
- 0-100 users: Monolith + in-memory queue + SignalR
- 100-1,000 users: Hangfire + Redis cache + read replicas
- 1,000-10,000 users: RabbitMQ + database sharding
- 10,000+ users: Microservices (notification service standalone)

---

### 4. Pitfalls (HIGH Confidence - Critical Prevention)

**TOP 5 Critical Pitfalls:**

1. **Falta de aislamiento de datos multi-empresa** (HIGH Risk)
   - **Warning sign:** Queries sin `WHERE EmpresaId = @CurrentTenant`
   - **Prevention:** Row-Level Security (RLS) en SQL Server + middleware que valide tenant en cada request
   - **Phase to address:** Fase 1 (Foundation)

2. **Sistema de notificaciones que spam o falla silenciosamente** (HIGH Risk)
   - **Warning sign:** Tiempo de respuesta de API aumenta cuando hay notificaciones
   - **Prevention:** Arquitectura async (message queue) + dead letter queue + circuit breaker + rate limiting
   - **Phase to address:** Fase 1 (Sistema de Notificaciones)

3. **Over-permissioning y escalada de privilegios** (HIGH Risk)
   - **Warning sign:** Frontend oculta botones pero backend endpoint es accesible para todos
   - **Prevention:** Policy-based authorization en backend + validación de aprobador ≠ solicitante
   - **Phase to address:** Fase 1 (Foundation)

4. **Acoplamiento excesivo con motor de flujos externo** (MEDIUM Risk)
   - **Warning sign:** Código de dominio tiene referencias a clases/namespaces del motor de flujos
   - **Prevention:** Anti-Corruption Layer (Adapter Pattern) + interface local `IWorkflowService`
   - **Phase to address:** Fase 2 (Captura de Órdenes)

5. **Validación débil de comprobaciones (XML/CFDI)** (HIGH Risk)
   - **Warning sign:** Validación solo verifica formato XML bien formado
   - **Prevention:** Integración con servicio SAT CFDI validation + UUID uniqueness check
   - **Phase to address:** Fase 3 (Tesorería)

**Performance traps a prevenir:**
- N+1 queries en notificaciones por usuario
- Missing index en EmpresaId
- Sincronizar llamadas a APIs externas
- No cachear catálogos corporativos

**UX pitfalls a evitar:**
- No distinguir canales de notificación en UI
- No indicar estado de delivery (enviado, leído, falló)
- No permitir reenvío de notificaciones
- Listas interminables sin filtros
- No mostrar historial de aprobaciones

---

## Open Questions (Phase-Specific Research Needed)

| Question | Phase | Priority | Why Important |
|----------|-------|----------|---------------|
| **SAT CFDI validation service specifications** | Fase 3 | HIGH | XML validation requirements for deducible/no deducible expenses |
| **Workflow engine API contract** | Fase 2 | HIGH | Companion's API schema, versioning, authentication not yet documented |
| **Telegram Bot API rate limits for Mexico** | Fase 1 | MEDIUM | Messages per second limits, webhook vs long polling, error handling |
| **SMTP provider rate limits** | Fase 1 | LOW | Specific provider constraints affect retry/exponential backoff |
| **.NET 10 GA date** | Foundation | MEDIUM | If starting immediately, use .NET 9 and upgrade later |

---

## Roadmap Implications

### Recommended Phase Structure (Based on Architecture Dependencies):

**Phase 1: Sistema de Notificaciones (MVP)**
- Multi-Company Data Model
- Granular RBAC + Policy-based Auth
- Event System (domain events)
- 3-Channel Notification Engine
- User Notification Preferences
- External Motor Integration (Read-Only)
- Audit Trail + Basic Dashboard

**Phase 2: Captura de Órdenes + Workflow Integration**
- PO/Invoice CRUD Interface
- External Motor Integration (Write)
- Anti-Corruption Layer for workflow API
- Vendor Management
- Document Upload (XML/PDF)

**Phase 3: Tesorería + Pagos**
- Payment Scheduling
- CFDI Validation (SAT integration)
- Payment Processing
- Treasury Dashboard
- Basic AP Reports

**Phase 4: Reportes Consolidados**
- Cross-company reporting
- Advanced analytics
- Export functionality

**Rationale:**
- Phase 1 first → Notification system enables transparency, validates multi-company + RBAC architecture
- Phase 2 second → Once notifications work, users need full transaction lifecycle
- Phase 3 third → After orders exist, treasury can process payments
- Phase 4 fourth → Requires data from all previous phases

---

## Technical Decisions Made

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| **Clean Architecture** | Testable, loosely coupled, isolates external dependencies | HIGH |
| **Policy-Based Authorization** | Handles multi-tenant complexity better than simple roles | HIGH |
| **Notification Strategy Pattern** | Easy to add channels, isolated failures, testable | HIGH |
| **MailKit for Email** | Replaces deprecated System.Net.Mail, cross-platform | HIGH |
| **Telegram.Bot** | De facto standard .NET Telegram client, actively developed | HIGH |
| **React Hot Toast** | Lightweight, beautiful defaults for in-app notifications | HIGH |
| **Async Notification Queue** | Prevents blocking HTTP responses, enables retries | HIGH |
| **Adapter Pattern for Workflow** | Isolates domain from external API changes | MEDIUM |
| **Row-Level Security for Multi-Tenant** | Prevents cross-tenant data leaks | MEDIUM-HIGH |

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **.NET 10 not GA** | MEDIUM | MEDIUM | Use .NET 9 for start, migrate to .NET 10 when available |
| **Elsa Workflows incompatible** | MEDIUM | LOW | Backup: n8n or custom workflow engine |
| **External workflow API undefined** | HIGH | LOW | Phase-specific research before Fase 2 |
| **SAT CFDI validation complexity** | MEDIUM | HIGH | Allocate research time in Fase 3, consider external service |
| **Telegram rate limiting** | LOW | MEDIUM | Implement exponential backoff + fallback to email |
| **Multi-tenant data leakage** | CRITICAL | MEDIUM | RLS + tenant middleware + authorization policies (Phase 1) |
| **Notification system spam** | HIGH | MEDIUM | Rate limiting + deduplication + circuit breaker (Phase 1) |

---

## Action Items Before Phase 1

### MUST Complete (Blocking):

1. **Verify .NET 10 availability**
   - Check if .NET 10 is GA or still in preview
   - If preview: decision to use .NET 9 temporarily
   - Owner: Technical Lead
   - Timeline: Before code start

2. **Define SMTP configuration**
   - Credentials already available (user confirmed)
   - Document: host, port, SSL/TLS, from address
   - Owner: DevOps
   - Timeline: Day 1 of Phase 1

### SHOULD Complete (Recommended):

3. **Research Telegram Bot API best practices**
   - Rate limits (30 msgs/sec)
   - Webhook vs long polling
   - Error handling patterns
   - Owner: Backend Developer
   - Timeline: Week 1 of Phase 1

4. **Set up development environment**
   - .NET SDK (9 or 10)
   - SQL Server Developer Edition
   - Node.js + npm (for React frontend)
   - Owner: All Developers
   - Timeline: Day 1 of Phase 1

### CAN Complete (Nice-to-Have):

5. **Review Elsa Workflows compatibility**
   - Test Elsa 3.x on .NET 10 preview
   - If incompatible: evaluate n8n
   - Owner: Backend Developer
   - Timeline: Week 2 of Phase 1 (non-blocking)

---

## Confidence Breakdown by Area

| Area | Confidence | Reasoning |
|------|------------|-----------|
| **Stack Technology** | HIGH | Core recommendations verified via official sources (Microsoft Learn, NuGet, npm, GitHub) |
| **Architecture Patterns** | HIGH | Clean Architecture + Policy-based Auth verified via Microsoft Learn official documentation |
| **Notification System** | MEDIUM | Standard patterns applied, but web search was rate-limited for current best practices |
| **Multi-Tenant Security** | HIGH | Well-established patterns in SaaS architecture, RLS is standard SQL Server feature |
| **Mexican SAT Compliance** | LOW-MEDIUM | Domain-specific knowledge, but CFDI validation specs need phase-specific research |
| **External Workflow Integration** | MEDIUM | Adapter pattern is standard, but specific API contract is unknown (companion's system) |
| **Telegram Bot Integration** | MEDIUM | General knowledge applied, rate limits and best practices need verification |

---

## Sources

### High Confidence Sources (Verified):
- **Microsoft Learn - Architectural principles in .NET** (official docs)
- **Microsoft Learn - Policy-based authorization in ASP.NET Core** (official docs)
- **Approve.com article on AP automation features** (webReader successful)
- **NuGet.org** (MailKit, Telegram.Bot packages verified)
- **npm registry** (react-hot-toast verified)
- **GitHub repositories** (Telegram.Bot active development verified)

### Medium Confidence Sources (General Knowledge):
- Multi-tenant SaaS patterns (industry standard)
- Role-based access control patterns (well-documented)
- Notification system architecture (established patterns)
- Anti-corruption layer pattern (Martin Fowler)

### Low Confidence Sources (Web Search Affected):
- Current 2026 AP automation trends (rate-limited)
- Competitor analysis (SAP Ariba, NetSuite, Tipalti)
- Specific workflow engine patterns

---

## Next Steps

1. **Review this summary with stakeholders** → Validate assumptions and priorities
2. **Resolve blocking action items** → .NET 10 availability, SMTP config
3. **Proceed to requirements definition** → Use research findings to scope v1 requirements
4. **Phase-specific research scheduled** → SAT CFDI validation (Fase 3), Workflow API (Fase 2)

---

**Research Complete ✓**
*All 4 dimensions (Stack, Features, Architecture, Pitfalls) investigated*
*Synthesis completed: 2026-03-20*
*Ready for requirements phase*
