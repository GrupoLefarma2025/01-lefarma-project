# Requirements: Sistema de Cuentas por Pagar - Grupo Lefarma

**Defined:** 2026-03-20
**Core Value:** Control total y auditoría completa: cada gasto tiene su flujo de autorizaciones ordenado, registrado y rastreable. Nadie puede "hacer mañas" ni decir "te lo envié / no vi nada".

## v1 Requirements

Requirements for initial release focused on **Sistema de Notificaciones** as first module. Each maps to roadmap phases.

### Foundation (Multi-Company + RBAC)

- [ ] **AUTH-01**: User can create account with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh (JWT authentication)
- [ ] **AUTH-05**: User can link their Telegram account to system profile
- [ ] **PERM-01**: System supports multi-company data isolation (5 companies: Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma)
- [ ] **PERM-02**: System supports multi-branch data isolation within each company
- [ ] **PERM-03**: Admin can assign users to companies with specific roles
- [ ] **PERM-04**: Admin can assign users to branches within companies
- [ ] **PERM-05**: System enforces data isolation - users only see data from their assigned companies/branches
- [ ] **PERM-06**: Contador (consolidated accountant) role can view data from all 5 companies
- [ ] **PERM-07**: Regular employees can only view their own data within their assigned company/branch
- [ ] **PERM-08**: Authorization policies prevent users from accessing companies/branches not assigned to them
- [ ] **PERM-09**: System logs all authorization attempts for audit trail

### Catalog Integration

- [ ] **CAT-01**: System loads existing corporate catalog of companies (ASK, LEF, ATC, CON, GRP with prefixes)
- [ ] **CAT-02**: System loads existing corporate catalog of branches (10 branches across 5 companies)
- [ ] **CAT-03**: System loads existing corporate catalog of chart of accounts (cuentas 600-604 with structure AAA-BBB-CCC-DD)
- [ ] **CAT-04**: System loads existing corporate catalog of cost centers (4 types: Operaciones, Administrativo, Comercial, Gerencia)
- [ ] **CAT-05**: System loads existing corporate catalog of expense types (Fijo, Variable, Extraordinario)
- [ ] **CAT-06**: System loads existing corporate catalog of areas (10 areas: RH, Contabilidad, Tesorería, Compras, Almacén, Producción, Ventas, Marketing, Tecnología, Calidad)
- [ ] **CAT-07**: System loads existing corporate catalog of units of measure (8 types: Piezas, Servicio, Kilos, Litros, Metros, Horas, Cajas, Kilowatts)
- [ ] **CAT-08**: Catalog data is read-only for security (integrates with existing corporate data)

### Notification System - Core Engine

- [ ] **NOTIF-01**: System emits domain events for business actions (order created, approved, rejected, paid, etc.)
- [ ] **NOTIF-02**: System supports 3 notification channels: In-app, Email, Telegram
- [ ] **NOTIF-03**: System delivers notifications asynchronously via background queue (non-blocking)
- [ ] **NOTIF-04**: System implements idempotency to prevent duplicate notifications for same event
- [ ] **NOTIF-05**: System persists notification delivery status (pending, sent, failed, bounced)
- [ ] **NOTIF-06**: System implements retry logic with exponential backoff for failed notifications
- [ ] **NOTIF-07**: System implements dead letter queue for notifications that repeatedly fail
- [ ] **NOTIF-08**: System implements circuit breaker to stop sending to failing channels (SMTP, Telegram API)
- [ ] **NOTIF-09**: System implements rate limiting per user per channel (max 5 notifications/hour)
- [ ] **NOTIF-10**: System supports notification priorities (urgent, normal, low)

### Notification System - In-App Channel

- [ ] **INAPP-01**: System saves in-app notifications to database for each recipient
- [ ] **INAPP-02**: System displays in-app notifications to users in real-time via SignalR/WebSocket
- [ ] **INAPP-03**: System shows notification badge count to users
- [ ] **INAPP-04**: User can mark in-app notifications as read/unread
- [ ] **INAPP-05**: User can view history of in-app notifications with filters (date, type, status)
- [ ] **INAPP-06**: System indicates delivery status for each in-app notification (sent, delivered, read)
- [ ] **INAPP-07**: In-app notifications are scoped to user's permissions (only see notifications for their data)

### Notification System - Email Channel

- [ ] **EMAIL-01**: System sends email notifications via SMTP using MailKit library
- [ ] **EMAIL-02**: System uses email templates for each notification type (order created, approved, rejected, payment scheduled, etc.)
- [ ] **EMAIL-03**: Email templates support variable substitution (recipient name, amount, company, link to action)
- [ ] **EMAIL-04**: System tracks email delivery status (sent, delivered, opened, bounced)
- [ ] **EMAIL-05**: System handles email delivery failures gracefully (retry, log, notify admin)
- [ ] **EMAIL-06**: Email contains deep link to relevant resource in system (e.g., "View Order" button)
- [ ] **EMAIL-07**: System respects SMTP rate limits and connection pooling

### Notification System - Telegram Channel

- [ ] **TELE-01**: System sends Telegram notifications via Telegram Bot API
- [ ] **TELE-02**: User must link their Telegram account (chat ID) to system profile before receiving Telegram notifications
- [ ] **TELE-03**: System stores user's Telegram chat ID securely in database
- [ ] **TELE-04**: System formats messages for Telegram (Markdown, inline buttons for approve/reject actions)
- [ ] **TELE-05**: System handles Telegram API rate limits (30 messages/second)
- [ ] **TELE-06**: System implements fallback to email if Telegram notification fails
- [ ] **TELE-07**: Telegram messages are scoped to user's permissions (only receive notifications for their data)
- [ ] **TELE-08**: System supports Telegram webhook for receiving user interactions (button clicks)

### Notification System - User Preferences

- [ ] **PREF-01**: User can specify which channels to receive for each notification event type
- [ ] **PREF-02**: User can enable/disable In-app notifications per event type
- [ ] **PREF-03**: User can enable/disable Email notifications per event type
- [ ] **PREF-04**: User can enable/disable Telegram notifications per event type
- [ ] **PREF-05**: System respects user preferences when dispatching notifications
- [ ] **PREF-06**: Admin can set default notification preferences for new users
- [ ] **PREF-07**: System allows user to configure "quiet hours" (no notifications during certain times)
- [ ] **PREF-08**: System allows user to configure digest mode (receive daily/weekly summary instead of immediate)

### Notification System - Event Types

- [ ] **EVENT-01**: System sends notification when new purchase order is created (to approvers)
- [ ] **EVENT-02**: System sends notification when purchase order is approved (to requester and next approver)
- [ ] **EVENT-03**: System sends notification when purchase order is rejected (to requester with reason)
- [ ] **EVENT-04**: System sends notification when payment is scheduled (to requester)
- [ ] **EVENT-05**: System sends notification when payment is completed (to requester)
- [ ] **EVENT-06**: System sends notification when expense proof is uploaded (to approvers)
- [ ] **EVENT-07**: System sends notification when expense proof is validated (to requester)
- [ ] **EVENT-08**: System sends notification when expense proof is rejected (to requester with reason)
- [ ] **EVENT-09**: System sends daily reminder of pending approvals (to approvers with items pending > X days)
- [ ] **EVENT-10**: System sends notification when user is mentioned in a comment

### Notification System - Admin & Configuration

- [ ] **ADMIN-01**: Admin can view notification delivery statistics (sent count, delivery rate, failure rate by channel)
- [ ] **ADMIN-02**: Admin can view notification queue status (pending, processing, failed)
- [ ] **ADMIN-03**: Admin can manually retry failed notifications
- [ ] **ADMIN-04**: Admin can configure notification templates (subject, body for email, message format for Telegram)
- [ ] **ADMIN-05**: Admin can view notification history with filters (date range, user, channel, event type, status)
- [ ] **ADMIN-06**: Admin can export notification delivery report (CSV/Excel)
- [ ] **ADMIN-07**: System alerts admin if notification delivery rate drops below threshold (e.g., < 80%)

### External Workflow Integration (Read-Only)

- [ ] **WORK-01**: System can read approval status from external workflow engine API
- [ ] **WORK-02**: System displays current approval status for each purchase order
- [ ] **WORK-03**: System displays approval history (who approved, when, comments)
- [ ] **WORK-04**: System handles external API failures gracefully (cache last known status, retry)
- [ ] **WORK-05**: System logs all external API calls for audit trail
- [ ] **WORK-06**: System implements circuit breaker for external API (stop calling if service is down)

### Basic Dashboard

- [ ] **DASH-01**: User can see pending approvals count requiring their action
- [ ] **DASH-02**: User can see recent activity (last 10 actions relevant to them)
- [ ] **DASH-03**: User can see notifications summary (unread count, recent notifications)
- [ ] **DASH-04**: Dashboard respects user permissions (contadores see consolidated, employees see their data only)
- [ ] **DASH-05**: Dashboard shows "last updated" timestamp (data is refresh-on-demand, not real-time)

### Audit Trail

- [ ] **AUDIT-01**: System logs all user actions with timestamp, user ID, company, branch, action type
- [ ] **AUDIT-02**: System logs all data changes (before/after values for critical fields)
- [ ] **AUDIT-03**: System logs all authorization successes and failures
- [ ] **AUDIT-04**: System logs all notification delivery attempts
- [ ] **AUDIT-05**: Admin can view audit logs with filters (date range, user, action type, company, branch)
- [ ] **AUDIT-06**: Audit logs are immutable (cannot be deleted or modified by users)
- [ ] **AUDIT-07**: Audit logs include correlation ID to track related actions across modules

### Basic Purchase Order Data Model (Foundation for Future Phases)

- [ ] **PO-01**: System stores purchase order with company, branch, area, expense type
- [ ] **PO-02**: System stores purchase order supplier data (RFC, name, contact info)
- [ ] **PO-03**: System stores purchase order line items (product, quantity, unit, unit price, tax, total)
- [ ] **PO-04**: System stores purchase order approval status
- [ ] **PO-05**: System stores purchase order totals (subtotal, tax, total)
- [ ] **PO-06**: System assigns unique sequential folio to each purchase order
- [ ] **PO-07**: System links purchase order to approval workflow ID (external engine)

## v2 Requirements

Deferred to future release after v1 notification system is validated.

### Purchase Order Management

- **PO-08**: User can create new purchase order with form-based interface
- **PO-09**: User can edit purchase order before submission
- **PO-10**: User can delete draft purchase orders
- **PO-11**: System validates required fields before allowing submission
- **PO-12**: System calculates totals automatically from line items

### Document Management (XML/PDF)

- **DOC-01**: User can upload XML file (CFDI) as expense proof
- **DOC-02**: User can upload PDF file as supporting document
- **DOC-03**: User can upload multiple documents per purchase order
- **DOC-04**: System validates XML structure for SAT compliance
- **DOC-05**: System stores uploaded files securely in file storage
- **DOC-06**: System links documents to purchase orders
- **DOC-07**: User can download uploaded documents

### Payment & Treasury

- **PAY-01**: Treasury user can view scheduled payments dashboard
- **PAY-02**: Treasury user can mark payment as scheduled (with payment date)
- **PAY-03**: Treasury user can record payment execution (amount, date, method)
- **PAY-04**: Treasury user can upload payment proof (bank receipt/deposit slip)
- **PAY-05**: System sends notification to requester when payment is completed
- **PAY-06**: System prevents duplicate payments (same invoice/UUID)

### Advanced Reporting

- **RPT-01**: User can generate aging report (pending approvals by age)
- **RPT-02**: User can generate payment history report (by date range, company, supplier)
- **RPT-03**: User can generate spend by supplier report
- **RPT-04**: User can generate spend by expense type report
- **RPT-05**: Contador can generate consolidated report across all 5 companies
- **RPT-06**: Reports can be exported to PDF/Excel
- **RPT-07**: Reports respect user permissions (row-level security)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| **Real-time dashboard updates** | Technical complexity (WebSockets) vs user value. Use refresh-on-demand with timestamp. |
| **Custom workflow builder UI** | External workflow engine handles this. We consume their API, not build workflow editor. |
| **Full accounting system** | Out of scope. Export pólizas to existing accounting system instead. |
| **Automatic bank reconciliation** | Too complex for v1. Manual import of bank statements is sufficient for now. Future v2+. |
| **Multi-currency support** | Grupo Lefarma is MXN-only. Defer until actual requirement emerges. |
| **Advanced analytics/AI** | Data science project. Basic reports first, advanced analytics later (v3+). |
| **Vendor self-registration portal** | Security risk, data quality issues. AP team registers vendors after validation. |
| **Unlimited notification customization** | Configuration explosion, support nightmare. Predefined event types with channel choice. |
| **Workflow branching based on text** | NLP complexity, fuzzy errors. Route based on structured fields (amount, type, area). |
| **OCR/invoice automation** | Too complex for MVP. Manual data entry first, automation in future phase. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 to AUTH-05 | Phase 1: Foundation | Pending |
| PERM-01 to PERM-09 | Phase 1: Foundation | Pending |
| CAT-01 to CAT-08 | Phase 1: Foundation | Pending |
| AUDIT-01 to AUDIT-07 | Phase 1: Foundation | Pending |
| PO-01 to PO-07 | Phase 1: Foundation | Pending |
| NOTIF-01 to NOTIF-10 | Phase 2: Notification Engine | Pending |
| INAPP-01 to INAPP-07 | Phase 2: Notification Engine | Pending |
| EMAIL-01 to EMAIL-07 | Phase 2: Notification Engine | Pending |
| TELE-01 to TELE-08 | Phase 2: Notification Engine | Pending |
| PREF-01 to PREF-08 | Phase 2: Notification Engine | Pending |
| EVENT-01 to EVENT-10 | Phase 2: Notification Engine | Pending |
| ADMIN-01 to ADMIN-07 | Phase 2: Notification Engine | Pending |
| WORK-01 to WORK-06 | Phase 3: Integration & Dashboard | Pending |
| DASH-01 to DASH-05 | Phase 3: Integration & Dashboard | Pending |

**Coverage:**
- v1 requirements: 76 total
- Mapped to phases: 76 (100%)
- Unmapped: 0 ✓

**Phase Distribution:**
- Phase 1: Foundation - 36 requirements (Auth, RBAC, Catalogs, Audit, PO Model)
- Phase 2: Notification Engine - 38 requirements (Core, 3 Channels, Preferences, Events, Admin)
- Phase 3: Integration & Dashboard - 11 requirements (External Workflow, Dashboard)
- Phase 4: Polish & Optimization - Performance, edge cases, monitoring

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
