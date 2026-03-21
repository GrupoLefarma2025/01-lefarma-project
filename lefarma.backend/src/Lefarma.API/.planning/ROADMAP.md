# ROADMAP: Sistema de Cuentas por Pagar - Grupo Lefarma

**Created:** 2026-03-20
**Granularity:** Coarse (3-5 phases, 1-3 weeks each)
**Mode:** YOLO (auto-approve)
**Coverage:** 76/76 v1 requirements mapped (100%)

---

## Phases

- [ ] **Phase 1: Foundation** - Multi-company auth, RBAC, catalogs, audit trail, PO data model
- [ ] **Phase 2: Notification Engine** - 3-channel async notification system (In-app, Email, Telegram)
- [ ] **Phase 3: Integration & Dashboard** - External workflow API, admin tools, basic dashboard
- [ ] **Phase 4: Polish & Optimization** - Performance tuning, edge cases, advanced monitoring

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Notification Engine | 0/3 | Not started | - |
| 3. Integration & Dashboard | 0/2 | Not started | - |
| 4. Polish & Optimization | 0/2 | Not started | - |

**Overall:** 0/10 plans complete (0%)

---

## Phase Details

### Phase 1: Foundation

**Goal:** Users can securely access the system with proper multi-company isolation and role-based permissions.

**Depends on:** Nothing (first phase)

**Requirements:**
- AUTH-01 to AUTH-05: User authentication (email/password, verification, password reset, JWT, Telegram linking)
- PERM-01 to PERM-09: Multi-company + multi-branch RBAC (data isolation, contador role, authorization policies)
- CAT-01 to CAT-08: Corporate catalog integration (companies, branches, chart of accounts, cost centers, expense types, areas, units)
- AUDIT-01 to AUDIT-07: Audit trail (user actions, data changes, authorization logs, notification logs, immutable)
- PO-01 to PO-07: Purchase order data model (company, branch, supplier, line items, approval status, totals, folio, workflow ID)

**Success Criteria** (what must be TRUE):
1. User can sign up with email/password, verify account, and log in with persistent session
2. User can only see data from their assigned companies/branches (contadores see all 5 companies)
3. User cannot access companies/branches not assigned to them (authorization policies enforced)
4. System logs all user actions and authorization attempts with timestamps
5. Purchase order data structure exists with company, branch, supplier, line items, and approval status

**Plans:** TBD

---

### Phase 2: Notification Engine

**Goal:** Users receive notifications through their preferred channels (In-app, Email, Telegram) for all relevant business events.

**Depends on:** Phase 1 (Foundation - auth, permissions, audit, PO model)

**Requirements:**
- NOTIF-01 to NOTIF-10: Core notification engine (domain events, 3 channels, async queue, idempotency, delivery status, retry logic, dead letter queue, circuit breaker, rate limiting, priorities)
- INAPP-01 to INAPP-07: In-app notification channel (database storage, SignalR real-time, badge count, read/unread, history, delivery status, permission scoping)
- EMAIL-01 to EMAIL-07: Email notification channel (MailKit SMTP, templates, variable substitution, delivery tracking, failure handling, deep links, rate limits)
- TELE-01 to TELE-08: Telegram notification channel (Bot API, chat ID linking, message formatting, rate limits, fallback to email, permission scoping, webhook)
- PREF-01 to PREF-08: User notification preferences (channel selection per event, quiet hours, digest mode, admin defaults)
- EVENT-01 to EVENT-10: Notification event types (order created/approved/rejected, payment scheduled/completed, expense proof uploaded/validated/rejected, pending approval reminders, mentions)
- ADMIN-01 to ADMIN-07: Notification admin & config (delivery statistics, queue status, manual retry, template configuration, history, export, alerts)

**Success Criteria** (what must be TRUE):
1. User receives notification in preferred channels (In-app, Email, Telegram) when purchase order is created/approved/rejected
2. User can configure which channels to use for each event type and set quiet hours
3. In-app notifications appear in real-time with badge count and read/unread status
4. Email notifications contain relevant details with deep link to action
5. Telegram notifications include inline buttons for approve/reject actions
6. System handles notification failures gracefully (retry, fallback, circuit breaker)
7. Admin can view delivery statistics and manually retry failed notifications

**Plans:** TBD

---

### Phase 3: Integration & Dashboard

**Goal:** Users can view approval status from external workflow engine and see relevant dashboard metrics.

**Depends on:** Phase 1 (Foundation), Phase 2 (Notification Engine)

**Requirements:**
- WORK-01 to WORK-06: External workflow integration (read approval status, display current status, approval history, API failure handling, audit logging, circuit breaker)
- DASH-01 to DASH-05: Basic dashboard (pending approvals count, recent activity, notifications summary, permission-based filtering, last updated timestamp)

**Success Criteria** (what must be TRUE):
1. User can see current approval status for each purchase order (from external workflow engine)
2. User can view approval history (who approved, when, comments)
3. User dashboard shows pending approvals count requiring their action
4. User dashboard shows recent activity and notifications summary
5. Dashboard respects user permissions (contadores see consolidated, employees see their data only)
6. System handles external API failures gracefully (cache last known status, retry)

**Plans:** TBD

---

### Phase 4: Polish & Optimization

**Goal:** System performs well under load, handles edge cases gracefully, and provides comprehensive monitoring.

**Depends on:** Phase 1 (Foundation), Phase 2 (Notification Engine), Phase 3 (Integration & Dashboard)

**Requirements:**
(All requirements from previous phases - this phase focuses on optimization, edge cases, and advanced monitoring)

**Success Criteria** (what must be TRUE):
1. System handles 100 concurrent users without performance degradation
2. System recovers gracefully from external service failures (SMTP, Telegram, workflow API)
3. System prevents notification spam (rate limiting, deduplication, quiet hours)
4. Admin receives alerts when notification delivery rate drops below threshold
5. System handles edge cases (network timeouts, invalid chat IDs, malformed emails)
6. Notification queue clears within 5 minutes under normal load

**Plans:** TBD

---

## Dependencies

```
Phase 1: Foundation (Auth + RBAC + Catalogs + Audit + PO Model)
    ↓
Phase 2: Notification Engine (Core + 3 Channels + Preferences + Events + Admin)
    ↓
Phase 3: Integration & Dashboard (External Workflow + Basic Dashboard)
    ↓
Phase 4: Polish & Optimization (Performance + Edge Cases + Monitoring)
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 → Phase 4

**Parallel opportunities:**
- Phase 4 can start as soon as Phase 3 is complete (performance testing can begin earlier)

---

## Risk Mitigation

| Risk | Impact | Mitigation Phase |
|------|--------|------------------|
| Multi-tenant data leakage | CRITICAL | Phase 1 (RLS + authorization policies) |
| Notification spam/failures | HIGH | Phase 2 (async queue + circuit breaker + rate limiting) |
| External workflow API undefined | HIGH | Phase 3 (adapter pattern + circuit breaker) |
| Performance degradation | MEDIUM | Phase 4 (load testing + optimization) |
| Telegram rate limiting | LOW | Phase 2 (exponential backoff + fallback to email) |

---

## Notes

**Granularity Rationale:**
- Coarse granularity (4 phases) balances focus with completion
- Each phase delivers complete, verifiable capability
- Foundation split from notifications to validate architecture early
- Integration happens after notifications work (enables full workflow visibility)
- Polish phase ensures production-readiness

**Key Architectural Decisions:**
- Clean Architecture with dependency inversion
- Policy-based multi-tenant authorization (prevents data leakage)
- Notification Strategy Pattern (3 channels: In-app, Email, Telegram)
- Async notification queue with dead letter queue
- Adapter pattern for external workflow API
- Row-Level Security (RLS) for multi-tenant isolation

**Technology Stack:**
- Backend: .NET 10 + EF Core + SQL Server
- Frontend: React + Vite + TypeScript
- Email: MailKit (4.13.0+)
- Telegram: Telegram.Bot (22.7.2+)
- Real-time: SignalR for in-app notifications
- Authorization: ASP.NET Core Policy-based Auth

**Next Step:** `/gsd:plan-phase 1`

---
*Roadmap created: 2026-03-20*
*Granularity: Coarse (4 phases)*
*Coverage: 76/76 requirements mapped (100%)*
