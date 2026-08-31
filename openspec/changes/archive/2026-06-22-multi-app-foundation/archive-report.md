# Archive Report: multi-app-foundation

**Change**: multi-app-foundation
**Project**: 01-lefarma-project
**Archive date**: 2026-06-22 (ISO 8601)
**Archive location**: `openspec/changes/archive/2026-06-22-multi-app-foundation/`
**Artifact store mode**: hybrid (filesystem archive + Engram mirror)
**Archive policy**: intentional-with-warnings (see Warnings section)

---

## Pre-flight Gate Results

| Gate | Required | Actual | Result |
|------|----------|--------|--------|
| Task Completion Gate | All implementation tasks `[x]` | 28/28 `[x]` (Phase 0: 6/6, Phase 1a: 5/5, Phase 1b: 5/5, Phase 2: 12/12 incl. BLOCKING prereq) | ✅ PASS |
| CRITICAL Gate (verify-report) | 0 CRITICAL issues | 0 CRITICAL | ✅ PASS |
| Verdict (sdd-verify) | — | PASS WITH WARNINGS | ✅ eligible for archive |

The single WARNING is pre-existing lint debt that exhibits zero regression and is explicitly out of scope for this change. CRITICAL count is zero, so per skill policy archive proceeds as **intentional-with-warnings**.

---

## Specs Synced to Source of Truth

These three capabilities did NOT previously exist in `openspec/specs/`. Per the "If Main Spec Does NOT Exist" branch of the OpenSpec convention, each delta spec IS a full spec and was copied directly to become the PERMANENT source of truth.

| Domain | Action | Details | New Path |
|--------|--------|---------|----------|
| `frontend-test-infra` | Created (NEW capability) | 5 requirements: Test Runner Entry Point, Component Test Environment, API Independence, Initial Smoke Coverage, Build and Lint Preservation | `openspec/specs/frontend-test-infra/spec.md` |
| `app-routing` | Created (NEW capability) | 5 requirements: `/CxP/` Deployment Prefix, Authentication Guard, Static App Registry, App Subtree Mounting, Gastos Backward Compatibility | `openspec/specs/app-routing/spec.md` |
| `base-app` | Created (NEW capability) | 5 requirements: Authenticated Shell Layout, Home Launcher, Profile Page, Excludes Administration UI, No Global Context Assumption | `openspec/specs/base-app/spec.md` |

**Totals**: 3 NEW capabilities, 15 NEW requirements, 0 modified, 0 removed, 0 renamed.

---

## Archive Contents Checklist

| Artifact | Present | Notes |
|----------|---------|-------|
| `proposal.md` | ✅ | Intent, scope, capabilities, risks, rollback plan |
| `specs/` (3 domains) | ✅ | frontend-test-infra, app-routing, base-app |
| `design.md` | ✅ | 5 architecture decisions, data flow, file changes, migration |
| `tasks.md` | ✅ | 28/28 tasks `[x]`; 0 unchecked implementation tasks (verified) |
| `verify-report.md` | ✅ | Verdict PASS WITH WARNINGS; 0 CRITICAL |
| `archive-report.md` | ✅ | This file |

---

## Verification Summary (from verify-report.md, Engram id 131)

- **Tests**: 21 passed / 0 failed / 0 skipped (`npm test`, exit 0)
- **Root build** (Gastos UNCHANGED proof): exit 0; `dist/index.html` has 0 `/CxP/` hits → renders `<AppRoutes>`
- **CxP build** (shell proof): exit 0; `dist/index.html` has 6 `/CxP/` hits → renders `<BaseAppRoutes>`
- **Lint**: 181/160/21 — IDENTICAL to PR 0 baseline (zero regression); NOT exit-zero due to pre-existing debt
- **Codemod gate**: 0 hits everywhere for old `services/authService`, `services/api`, `store/authStore` paths (including sibling-relative forms)
- **Spec compliance**: 22/23 scenarios COMPLIANT, 1 PARTIAL (the lint scenario, pre-existing debt)
- **Design coherence**: zero design deviations

---

## Warnings (intentional-with-warnings archive)

1. **frontend-test-infra "Existing scripts still pass" is PARTIAL.** The spec scenario requires `npm run lint` to exit zero with zero warnings. Reality: lint reports 181 problems (160 errors, 21 warnings) and exits non-zero. This is **pre-existing cross-cutting debt** that predates this change (documented in PR 0 gate notes) and exhibits **ZERO regression** (181 before == 181 after, identical across PR 0/1a/1b/2). The spec's non-regression *intent* ("SHALL NOT regress existing scripts") is fully met; only the literal "exit zero" remains unmet because the baseline was never green. Per skill policy, non-CRITICAL warnings with zero regression do not block archive; this is recorded as **intentional-with-warnings**.

**Recommendation (out of scope)**: address the 181 pre-existing lint problems in a dedicated cleanup change so the spec's literal "exit zero" can be satisfied.

**Process improvement note**: the design's original gate regex `services/(authService|api)|store/authStore` missed sibling-relative imports (`./authStore`, `./api`); this was discovered and fixed during PR 1b (7 sibling consumers rewritten). Future codemods should default to a sibling-aware regex. Captured here for institutional memory.

---

## Engram Observation Traceability

All SDD phase artifacts for this change are persisted in Engram (project `01-lefarma-project`) for cross-session traceability:

| Artifact | Engram Observation ID | Topic Key |
|----------|----------------------|-----------|
| Proposal | 118 | `sdd/multi-app-foundation/proposal` |
| Spec (aggregate) | 119 | `sdd/multi-app-foundation/spec` |
| Design | 121 | `sdd/multi-app-foundation/design` |
| Tasks | 122 | `sdd/multi-app-foundation/tasks` |
| Apply-progress (merged PR 0+1a+1b+2) | 123 | `sdd/multi-app-foundation/apply-progress` |
| Verify-report | 131 | `sdd/multi-app-foundation/verify-report` |
| Archive-report (this file) | _new_ | `sdd/multi-app-foundation/archive-report` |

---

## Source of Truth (now authoritative)

The following specs are the PERMANENT source of truth for these capabilities:

- `openspec/specs/frontend-test-infra/spec.md`
- `openspec/specs/app-routing/spec.md`
- `openspec/specs/base-app/spec.md`

---

## SDD Cycle Complete

The `multi-app-foundation` change has been fully **proposed → specified → designed → tasked → implemented → verified → archived**.

- 28/28 implementation tasks complete
- 22/23 spec scenarios compliant (1 PARTIAL, pre-existing debt, zero regression)
- 0 CRITICAL issues
- 3 NEW capabilities promoted to permanent source of truth
- Gastos root build provably unchanged; `/CxP/` shell build provably correct

**The SDD cycle for `multi-app-foundation` is complete. Ready for the next change.**

---

*Archive operations only. No git commit/push/PR performed — the implemented code stays in the working tree; the user decides commit timing.*
