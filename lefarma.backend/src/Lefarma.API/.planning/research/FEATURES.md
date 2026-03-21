# Feature Research: Accounts Payable & Notification Systems

**Domain:** Cuentas por Pagar (Accounts Payable) + Sistema de Notificaciones
**Researched:** 2026-03-20
**Confidence:** MEDIUM

**Research Note:** Web search tools experienced rate limiting issues. Research based on:
- Project context from Grupo Lefarma requirements
- Approve.com article on AP automation features (HIGH confidence)
- Industry knowledge of multi-tenant SaaS patterns (MEDIUM confidence - needs verification)
- Standard RBAC and notification system patterns (HIGH confidence)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any AP system. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Invoice Capture & Data Entry** | Users need to record purchase orders and invoices | MEDIUM | Manual entry initially, OCR/integration future phase |
| **Approval Workflow Routing** | Every AP system requires multi-level approvals | HIGH | Core requirement - motor externo handles this |
| **Vendor/Supplier Management** | Need to track who we pay and their details | LOW-MEDIUM | Basic CRUD for suppliers |
| **Payment Scheduling** | Users need to plan when payments occur | MEDIUM | Treasury module functionality |
| **Audit Trail** | Compliance requires "who did what when" | MEDIUM | Critical for "nadie puede hacer mañas" |
| **Role-Based Access Control** | Different users need different permissions | HIGH | Contadores see all, employees see theirs, gerentes approve |
| **Basic Reporting** | Aging reports, payment history, spend by supplier | MEDIUM | Standard AP reports |
| **Multi-Company Support** | Grupo Lefarma has 5 companies | HIGH | Data isolation + consolidated view |
| **Email Notifications** | Users expect email for approvals, payment confirmations | LOW-MEDIUM | SMTP credentials already available |
| **Document Attachment (XML/PDF)** | SAT compliance requires XML attachments | MEDIUM | Comprobación de gastos requirement |
| **Purchase Order Matching** | 3-way matching (PO, receipt, invoice) is standard | MEDIUM | Prevents overpayments and fraud |
| **Duplicate Detection** | Basic sanity check to avoid paying twice | LOW | Simple business rule validation |

**Why these are table stakes:**
- Without approval workflows, you can't control spending
- Without RBAC, anyone can do anything (violates core value proposition)
- Without audit trail, no accountability ("te lo envié / no vi nada")
- Without multi-company, can't serve the 5 companies in Grupo Lefarma
- Without notifications, users don't know action is required

### Differentiators (Competitive Advantage)

Features that set this product apart from generic AP systems.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Parametrizable Multi-Channel Notifications** | Users choose channels per event type (In-app + Email + Telegram) | HIGH | First module to build - unique flexibility |
| **Dynamic Approval Workflows (External Motor)** | N-level approvals with dynamic routing based on amount, type, business rules | VERY HIGH | Differentiator: companion's engine + our integration |
| **Granular Multi-Company Permissions** | Role can span multiple companies with different permission levels per company | HIGH | "Contador consolidado" sees all, "Gerente Área" sees specific company |
| **Branch-Level (Sucursal) Scoping** | Permissions and data visibility scoped to specific branches | HIGH | 3-3-3-1-1 branches across 5 companies |
| **SAT-Compliant Expense Verification** | XML validation for Mexican tax compliance (deducible vs no deducible) | MEDIUM | Domain-specific to Mexican market |
| **Vendor Portal (Self-Service)** | Suppliers submit invoices, check payment status online | MEDIUM | Future phase - reduces AP staff workload |
| **Centralized Catalog Integration** | Uses existing corporate catalogs (cuentas contables, centros de costo, áreas) | MEDIUM | Not rebuilding standard data, integrating existing |
| **Consolidated Treasury View** | See all scheduled payments across 5 companies in one dashboard | HIGH | Value for grupo-level treasury team |
| **Mobile Approvals via Telegram** | Approve/reject POs from phone via Telegram bot | MEDIUM | Unique channel for urgent approvals |
| **Workflow Visualization** | See where each PO is in approval chain, who's holding it up | MEDIUM | Transparency reduces "no vi nada" excuses |

**Differentiation Strategy:**
- **Not competing on:** basic AP features (table stakes)
- **Competing on:** notification flexibility, multi-tenant granularity, workflow transparency, Mexican market compliance

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Dashboard Updates** | "See everything as it happens" | Technical complexity (WebSockets), server load, minimal user value for AP | Refresh-on-demand with "last updated" timestamp |
| **Custom Workflow Builder** | "Let users design their own approvals" | Scope creep, maintenance nightmare, edge cases | Use external motor de flujos (companion's API) |
| **Full Accounting System** | "Handle everything in one place" | Out of scope, different domain, reinvents wheel | Export pólizas to existing accounting system |
| **Automatic Bank Reconciliation** | "Match payments to bank statements automatically" | Complex, error-prone, varies by bank | Manual import of bank statements, future phase |
| **Multi-Currency** | "We pay international suppliers" | Adds complexity,Grupo Lefarma likely MXN-only | Defer until actual requirement emerges |
| **Advanced Analytics/AI** | "Predict cash flow, detect anomalies" | Data science project, not MVP | Basic reports first, advanced analytics later |
| **Vendor Self-Registration** | "Let suppliers sign themselves up" | Security risk, data quality issues, onboarding validation | AP team registers vendors after validation |
| **Bulk Action Everything** | "Approve 50 invoices at once" | Easy to make mistakes, bypasses controls | Limited bulk actions (only low-risk items) |
| **Unlimited Notification Customization** | "Let every user define their own rules" | Configuration explosion, support nightmare | Predefined event types with channel choice per event |
| **Workflow Branching Based on Text** | "Route based on description keywords" | NLP complexity, fuzzy matching errors | Route based on structured fields (amount, type, area) |

**Anti-Feature Philosophy:**
- Each "no" protects focus and prevents rewrites
- Document rationale to defend against future scope creep
- Some may become v2+ features, but not v1

## Feature Dependencies

```
[Multi-Company Data Model]
    └──requires──> [Granular RBAC System]
                       └──requires──> [User-Company-Role Mapping]

[Approval Workflow Integration]
    └──requires──> [External Motor API Consumption]
                       └──requires──> [PO/Invoice Data Model]

[Parametrizable Notifications]
    ├──requires──> [Event System (domain events)]
    ├──requires──> [User Notification Preferences]
    └──enhances──> [Approval Workflow Integration]

[Telegram Notifications]
    └──requires──> [User-Telegram Linking]
                       └──requires──> [User Profile Management]

[SAT Expense Verification]
    └──requires──> [XML/PDF Storage & Validation]
                       └──enhances──> [Invoice Capture]

[Consolidated Reporting]
    └──requires──> [Multi-Company Data Model]
    └──requires──> [Unified Chart of Accounts Integration]

[Treasury Module]
    ├──requires──> [Payment Scheduling]
    ├──requires──> [Bank Account Management]
    └──enhances──> [Multi-Company Data Model]
```

### Dependency Notes

- **Multi-Company requires Granular RBAC:** Can't isolate data per company without roles that specify which companies a user can access
- **Approval Workflow requires External Motor:** Key architectural decision - consume companion's API instead of building
- **Notifications enhance Approval Workflow:** The 3-channel notification system is the force multiplier for workflow effectiveness
- **Telegram requires User Linking:** Can't send Telegram messages without users linking their accounts (onboarding friction)
- **SAT Verification enhances Invoice Capture:** XML validation adds value beyond basic invoice storage
- **Consolidated Reporting requires Multi-Company:** Can't consolidate without multi-company data model
- **Treasury enhances Multi-Company:** Treasury team needs grupo-level view, not per-company

## MVP Definition

### Launch With (v1 - Sistema de Notificaciones)

Minimum viable product focused on notification system as first module.

- [ ] **User Management with Multi-Company Roles** — Foundation for everything else
- [ ] **Company & Branch Catalog Integration** — Use existing corporate catalogs
- [ ] **Basic PO/Invoice Data Model** — Core domain entities
- [ ] **Event System (Domain Events)** — Emit events for approval actions, payment events
- [ ] **Notification Engine (In-App + Email + Telegram)** — Core value prop
- [ ] **User Notification Preferences** — Per-event channel selection
- [ ] **External Motor Integration (Read-Only)** — Consume approval status from companion API
- [ ] **Basic Dashboard** — Show pending approvals, recent activity
- [ ] **Audit Trail** — Log all actions for compliance

**Why this MVP:**
- Notification system is first module (per PROJECT.md decision)
- Enables visibility and transparency for existing processes
- Validates multi-company + RBAC architecture
- Low enough complexity to ship quickly
- High enough value to get user feedback

### Add After Validation (v1.x)

Features to add once notification system is working and validated.

- [ ] **PO/Invoice CRUD Interface** — Let users create and manage orders (v1.1)
- [ ] **External Motor Integration (Write)** — Submit approvals to companion API (v1.2)
- [ ] **XML/PDF Upload & Storage** — Document attachment support (v1.3)
- [ ] **Basic AP Reports** — Aging, payment history (v1.4)
- [ ] **Vendor Management** — Supplier master data (v1.5)
- [ ] **Payment Scheduling** — Treasury module v1 (v1.6)

**Triggers for adding:**
- v1.1: When users can see notifications but need to act on them
- v1.2: When motor companion API is stable
- v1.3: When SAT compliance becomes urgent
- v1.4-1.6: When basic workflow is validated

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Full Procure-to-Pay Workflow** — Complete PO lifecycle (v2)
- [ ] **3-Way Matching Automation** — PO vs receipt vs invoice (v2.1)
- [ ] **Duplicate Detection** — Advanced de-duplication (v2.2)
- [ ] **Vendor Portal** — Self-service supplier portal (v2.3)
- [ ] **Advanced Treasury** — Payment optimization, cash flow forecasting (v2.4)
- [ ] **Advanced Analytics** — Custom reports, dashboards (v3)
- [ ] **AI/ML Features** — Anomaly detection, smart coding (v3+)
- [ ] **Automatic Bank Reconciliation** — Bank statement matching (v3+)

**Why defer:**
- Can't validate core value without v1
- Advanced features add complexity without proving value
- Market may not need full P2P (may only need notification layer)
- Companion's motor may handle some of this

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-Company RBAC | HIGH | HIGH | P1 |
| Notification Engine (3-Channel) | HIGH | MEDIUM | P1 |
| User Notification Preferences | HIGH | LOW | P1 |
| Event System | HIGH | MEDIUM | P1 |
| External Motor Integration | HIGH | MEDIUM | P1 |
| Audit Trail | HIGH | MEDIUM | P1 |
| Basic Dashboard | MEDIUM | LOW | P1 |
| PO/Invoice CRUD | HIGH | MEDIUM | P2 |
| XML/PDF Storage | MEDIUM | MEDIUM | P2 |
| Vendor Management | MEDIUM | LOW | P2 |
| Payment Scheduling | HIGH | MEDIUM | P2 |
| Basic Reports | MEDIUM | MEDIUM | P2 |
| 3-Way Matching | MEDIUM | HIGH | P3 |
| Vendor Portal | LOW | HIGH | P3 |
| Advanced Analytics | MEDIUM | HIGH | P3 |
| Bank Reconciliation | LOW | VERY HIGH | P3 |

**Priority key:**
- **P1:** Must have for v1 launch (Sistema de Notificaciones)
- **P2:** Should have, add in v1.x after validation
- **P3:** Nice to have, v2+ consideration

**Cost estimation:**
- **LOW:** 1-3 days, well-understood patterns
- **MEDIUM:** 1-2 weeks, some complexity but standard approaches
- **HIGH:** 2-4 weeks, complex integration or business logic
- **VERY HIGH:** 1-2 months, R&D required or high uncertainty

## Competitor Feature Analysis

| Feature | Tipalti Procurement | SAP Ariba | NetSuite AP | Our Approach |
|---------|---------------------|-----------|-------------|--------------|
| **Approval Workflows** | Configurable rules | Complex workflow engine | Standard approvals | External motor (companion API) - flexible without building complexity |
| **Notifications** | Email + in-app | Email + in-app | Email | In-app + Email + Telegram (3-channel parametrizable) |
| **Multi-Entity** | Supported | Supported | Supported | Multi-company + multi-branch with granular RBAC |
| **Vendor Portal** | Self-service portal | Supplier network | Vendor portal | Future v2.3 - not MVP |
| **AP Automation** | OCR, matching, PO matching | Full P2P suite | Invoice matching | Manual first, automation later |
| **Reporting** | Advanced analytics | Advanced BI | Standard reports | Basic reports first, advanced later |
| **Integration** | ERP, HRIS, SSO | SAP ecosystem | NetSuite ecosystem | Use existing catalogs, export pólizas to accounting |

**Our differentiation:**
- **Not competing on:** full P2P suite, OCR/invoice automation (yet)
- **Competing on:** notification flexibility (3-channel), multi-tenant granularity, Mexican market compliance, workflow transparency
- **Key advantage:** Lean, focused v1 vs bloated enterprise suites

## Sources

### High Confidence Sources
- **Approve.com article on AP automation features** - Detailed breakdown of procurement/P2P workflow, benefits, and feature expectations (webReader successful retrieval)
- **PROJECT.md** - Grupo Lefarma specific requirements and constraints

### Medium Confidence Sources
- **Multi-tenant SaaS patterns** - Standard database isolation models (shared DB/shared schema, shared DB/separate schema, separate DB per tenant) based on industry knowledge - needs verification with official Azure/AWS docs
- **RBAC patterns** - Role-based access control is industry standard for enterprise permissions (HIGH confidence based on general knowledge)

### Low Confidence Sources (Web Search Affected)
- **Accounts payable automation 2025/2026 trends** - Web search rate limiting prevented access to current sources
- **Competitor analysis (SAP Ariba, NetSuite)** - Limited by web search issues, based on general knowledge
- **Notification system best practices** - General knowledge applied, could benefit from specific sources

### Gaps Requiring Phase-Specific Research
1. **Mexican SAT compliance specifics** - XML validation requirements for deducible/no deducible expenses
2. **Telegram Bot API patterns** - Best practices for enterprise approval workflows via Telegram
3. **External motor integration patterns** - How to consume companion's approval workflow API safely
4. **Multi-company reporting patterns** - Consolidated financial reporting across 5 entities

### Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Table Stakes Features | HIGH | Approve.com article + standard AP knowledge |
| Differentiation Strategy | HIGH | Based on PROJECT.md Core Value |
| Notification System Features | MEDIUM | General knowledge, lacks specific sources on best practices |
| Multi-Tenant Patterns | MEDIUM | Standard patterns known, but lack official Azure/AWS documentation |
| RBAC Implementation | HIGH | Industry standard, well-documented patterns |
| Mexican SAT Compliance | LOW | Domain-specific knowledge, needs phase-specific research |
| Competitor Analysis | LOW-MEDIUM | Web search issues, based on general knowledge |

---

**Next Steps for Roadmap:**
1. Use Table Stakes to define v1 scope (Sistema de Notificaciones)
2. Use Differentiators to define v1.x/v2 features
3. Use Anti-Features to defend against scope creep
4. Use Dependencies to order phases (RBAC before Notifications before Treasury)
5. Validate low-confidence areas in phase-specific research

*Feature research for: Cuentas por Pagar + Sistema de Notificaciones*
*Researched: 2026-03-20*
