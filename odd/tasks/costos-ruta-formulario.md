# Route cost demo: branch-based working-day form

## Status and authorization

- Implementation and bounded local checks are explicitly authorized. T1 backend checks are green; T2 form/hospital/example implementation exists with 45 frontend tests previously reported green. The tracker was stale; current regression work and T4 print/source corrections are in progress. Independent live acceptance remains pending.
- Project: `01-lefarma-project`; branch observed: `feature/costos-ruta-demo`.
- Tracker: `odd/tasks/costos-ruta-formulario.md`.
- Full Engram mirror: project `01-lefarma-project`, topic `odd/costos-ruta-formulario/tasks`. Mirror identity and exact readback are reported separately; this entire document is the mirror payload, not a summary.
- RDD: ON, global scope, as requested; record only, no global configuration mutation.
- TDD (Test Driven Development): UNCONFIRMED. Installed runners and existing tests do not establish a red/green workflow or user consent to that mode.
- NO commits while iterating. The user's explicit instruction overrides the routine ODD work-unit commit rule. No stage, reset, commit, push, remote calls, or pull request (PR) creation. No PR consent granted.
- Current authorization permits this direct writer to implement the scoped feature and run foreground unit/type/lint checks with explicit timeouts. No persistent processes or child agents. Parent performs independent Playwright acceptance. No RDD configuration changes or reviewSTART.
- Preserve all existing staged and unstaged work, including route-cost changes, Program.cs, environment files, RH pages, editors, and appsettings.Development.json. Their presence is not evidence of this task's completion.

## Outcome and fixed scope

Replace the editable JSON textarea with persons, each person's branch origin, and ordered hospital destinations from existing catalogs. Reuse the existing catalog requests and shared API client; do not create application services, interfaces, endpoints, catalogs, database structures, migrations, authentication changes, or geocoding.

- Default the selected date to tomorrow in the browser's LOCAL calendar, including month/year rollover. Do not derive it from UTC ISO slicing or silently advance to the next business day.
- Presence defaults to the person's full working day (`08:00–18:30`), as a requested window. Optional destination start/end overrides take visible precedence for actual appointments; no visit duration is inferred.
- Preserve explicit departure and every original date exactly. Friday 16:57 is not rejected merely because requested presence begins at 08:00: calculate and report route lateness/infeasibility. Validate chronological activity bounds, not unequal calendar dates; expose same-day overlaps without shifting dates.
- Retain current weekday constraints and explain conflicts with a selected non-working day; do not invent a holiday calendar or new scheduling policy.
- Preserve own-car selection, magna/premium, sharing, existing calculation options, fixed `12 km/L`, and all existing result sections.
- Coordinates must come from the selected catalog record. Missing/unusable coordinates block calculation; suspicious coordinates outside Mexico have a visible informational warning and must not support an unqualified real-route viability claim. Never write catalogs or substitute coordinates.
- Generate a typed, read-only payload preview from form state; preview and submitted request must match. Users must not need to author JSON.
- Keep the existing calculator and response contract. No global JSON serializer change, especially not Program.cs. Adapt only the route-cost request boundary.

## Observed code and uncertainty

Earlier source-only observations below are historical, not the current acceptance state. Parent independently observed both catalogs HTTP 200 (11 branches / 4,814 hospitals), a real local login, and the Friday 16:57 frontend rejection. After restart, the original snake_case request returned HTTP 200 with six noncompliant proposals; the previously reported live 400 was not reproduced. Origin Antonio Maura coordinates 1,2 are suspicious, not verified geography. No catalog data may be repaired by this task.

- `lefarma.frontend/src/apps/educacion-medica/pages/costos/CostosDemoPage.tsx`: `EJEMPLO` contains `carro_propio`, `hora_entrada`, and `fecha_inicio_actividad`; the page parses editable JSON and submits unknown person objects. Its example working hours already use `08:00` and `18:30`.
- `lefarma.frontend/src/apps/educacion-medica/types/costosRuta.types.ts`: request `personas` is `unknown[]`; calculation options currently use camelCase.
- `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/DTOs/CostosRutaDtos.cs`: request properties include `CarroPropio`, `HoraEntrada`, and `FechaInicioActividad` without explicit JSON names. Current backend working-hour defaults are `09:00–18:00`, not the selected form defaults.
- `lefarma.backend/src/Lefarma.API/Program.cs:392–401`: controller JSON configuration sets `PropertyNameCaseInsensitive = true`; it does not declare a snake_case naming policy. Static evidence supports a request-key mismatch; the regression still needs an execution-based test. Do not fix it globally.
- `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/CalculoCostosRuta.cs`: fixed `RendimientoKmL = 12.0`; requires 1–9 persons and contiguous place order starting at 1 with a `salida` origin. Destination normalization supports `taller` activity start/end and date/time ordering. It also has outbound HTTP paths: future tests must intercept all of them.
- `lefarma.frontend/src/pages/catalogos/generales/Sucursales/SucursalesList.tsx`: existing `fetchSucursales` uses the shared `API.get` catalog flow; branch objects expose latitud/longitud. Reuse that flow without changing the catalog page or creating another service.
- `lefarma.backend/src/Lefarma.API/Features/Catalogos/Sucursales/SucursalService.cs`: existing branch mapping includes latitude and longitude. Actual catalog contents, coordinate completeness, catalog access, and live route feasibility are UNKNOWN; no database or remote request was made.
- `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/CostosRutaServiceTests.cs`: existing xUnit tests construct DTOs directly and use a failing fake HTTP handler. Those shown tests bypass JSON deserialization, so they do not demonstrate snake_case binding.

## Tasks

| ID | Status | Cohesive behavior and acceptance | Verification and rollback boundary |
| --- | --- | --- | --- |
| T1 | backend verified; reported live 400 unresolved | Existing setter-only snake_case aliases demonstrably bind on .NET 10.0.12; no speculative alias/getter change. Preserve both snake_case person/work/place inputs and camelCase clients/options. Correct only the reproduced DTO default-hours defect: 09:00–18:00 -> 08:00–18:30. Strengthen tests with the DI-registered SystemTextJsonInputFormatter matching Program.cs JSON options, non-default car/work/day/date/activity/option values, the unchanged original 2026-10-15/16 payload through the controller, and omitted date -> exact 400 message. Retain fixed-12, sharing, and response-contract regressions. | From repo root, command A: `dotnet test lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --no-restore --filter FullyQualifiedName~CostosRutaServiceTests --verbosity quiet --logger "console;verbosity=normal" -p:OutputPath=C:\Users\Auxiliar\AppData\Local\Temp\opencode\costos-ruta-backend-validation\bin\ -p:UseSharedCompilation=false -nodeReuse:false`. Baseline A: 9 passed / 0 failed; after new regressions, before DTO fix: 11 passed / 1 failed (expected 08:00, actual 09:00); after fix: 12 passed / 0 failed. Command B: `dotnet test lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --no-restore --no-build --verbosity quiet --logger "console;verbosity=minimal" -p:OutputPath=C:\Users\Auxiliar\AppData\Local\Temp\opencode\costos-ruta-backend-validation\bin\ -p:UseSharedCompilation=false -nodeReuse:false`: 308 passed / 0 failed / 0 skipped. Foreground wrapper: `C:\Users\Auxiliar\AppData\Local\Temp\opencode\costos-ruta-guarded-test.py`, child timeout 180s with kill-tree on timeout/finally; no timeout occurred. Fake HTTP only; no database/provider calls or app server start. Source search found no custom/generated JSON resolver configuration. Valid original snake/camel bodies return 200 through the in-process formatter/controller; missing activity date returns 400. Reported live 400 is NOT reproduced or declared fixed. API PID 32800 remains running and untouched; normal API DLL git-blob hash `47386300cf06a55ca81f62f2d1f7f29fdbbba475` differs from validated isolated DLL `c697c78d22a46619a66a671e7c23f8097f3f950a`: runnable normal binary NOT refreshed. Staged raw object IDs unchanged; no commits/stage/reset or Engram mutation. TDD mode remains unconfirmed. Rollback: only the two default-hour lines and this phase's added/modified test hunks; preserve pre-existing aliases, tests, staged calculator refactor, Program.cs, appsettings, environment files, and all frontend work. Live request/deployment reconciliation remains for parent/T3. |
| T2 | implemented; regression corrections in progress | Branch origins, hospital catalog destinations, local tomorrow, person work hours, generated preview, preserved options/results. Remove the departure-before-presence blocker; add optional per-destination windows and coordinate previews/warnings. | Previous frontend checks: 45 tests green, reported by parent. New regression RED/GREEN and exact commands are recorded below when executed. Preserve unrelated files and catalog data. |
| T3 | pending; depends on T1 and T2 | Verify request/form/calculator integration and record exact command outputs, read back this tracker and its FULL Engram mirror, and inspect the authored diff against the preserved starting state. Delivery remains pending until acceptance evidence exists; NO commits and NO PR. | Runtime boundary exists: branch catalog selection -> generated request -> existing calculation endpoint -> preserved results. Future harness must be local, mocked, bounded, and explicitly authorized; no ambient sessions or provider calls. Record NOT RUN now, not N/A or passed. Rollback: only this feature's newly authored hunks and test fixtures, never a whole-file reset over pre-existing work. |
| T4 | in progress | Preserve all 20 FOR-008 trips, original ranges and FOR-007 taxi visit dates, terminal departures and source conflicts. Never choose an arbitrary hospital by city or infer appointment lengths. FOR-008: thirteen leaf columns, landscape, selected-mode-only costs. FOR-007: individual portrait request, documented headings/sections and blank signatures. Capture successful request/response together; explicitly select printable proposals/person; isolate print portal and clean up body classes. Unknown prices remain unknown, not zero. | Fresh local anydoc conversions are primary evidence. Unit tests cover exact dates/transport, ambiguous matching, selected-mode arithmetic, unknown fields, snapshots, both report DOMs and print cleanup. Parent must independently verify calculation and both print DOMs in Playwright before T3 can be complete. |

## Runners and commands: observed, not executed

Frontend evidence: `lefarma.frontend/package.json` defines `test = vitest run`, `test:watch = vitest`, `test:e2e = playwright test`, `build = tsc && vite build`, and `lint = eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`. Vitest is `^3.2.4`; Playwright is `^1.58.2`.

- From `P:\Trabajo\01-lefarma-project\lefarma.frontend`: `npm run test -- --reporter=verbose` (one-shot Vitest).
- Same cwd: `npm run test:e2e -- --project=chromium` (Playwright). The default `playwright.config.ts` starts `npm run dev -- --port 5180 --strictPort`; this is not a read-only command and is NOT authorized during preparation.
- Same cwd: `npm run build` and `npm run lint` are available future checks, NOT executed.
- `vitest.config.ts` uses jsdom, React, `src/test/setup.ts`, and excludes `tests/**` from Vitest collection. New component tests belong in Vitest's collected source tree, not the Playwright folder.

Backend evidence: `lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj` targets `net10.0`, references `Microsoft.NET.Test.Sdk 18.0.1`, `xunit 2.9.3`, `xunit.runner.visualstudio 3.1.5`, Moq and FluentAssertions, and references the API project. `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` also targets `net10.0`.

- From `P:\Trabajo\01-lefarma-project`: `dotnet test lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter FullyQualifiedName~CostosRutaServiceTests --verbosity normal`.
- Keep route-cost binding regressions in that focused class or revise the filter explicitly when a different test class is authored. Do not claim a proposed test filename already exists.
- T1 execution evidence is in its task row. Current worker records actual frontend RED/GREEN below; no strict TDD workflow or source is claimed. Live E2E acceptance is reserved for the parent.

## Review workload and delivery

- Forecast: approximately **450–700 authored additions plus deletions** for a cohesive form, request-binding repair, and tests. This is an advisory estimate, not a measured feature diff, an implementation authorization, or an approved size exception.
- Existing staged changes are unrelated baseline work for this preparation and are not part of that forecast.
- T1 and T2 are behavior-oriented work units with their tests, not commits by file type. T3 is acceptance/readback. No commit identity exists for these tasks.
- The approximately 400-line heuristic is advisory, not a hard cap. Keep cohesive print/source tests even if larger; no commit or delivery planning until requested. Delivery: PENDING / NO COMMITS.

## Preparation receipt and next step

- Requested skills loaded: repository `karpathy-guidelines` and installed `work-unit-commits`. Also loaded `cognitive-doc-design` for the tracker and `codebase-memory` for structural inspection; available CodeGraph explore used instead of unavailable graph APIs described by that skill.
- Skill resolution: minimal scoped changes, explicit assumptions, measurable acceptance, tests with behavior, and independent rollback boundaries retained. Routine commit/PR steps are overridden by the explicit NO-COMMITS instruction.
- Full-backup script loaded: `C:\Users\Auxiliar\AppData\Local\Temp\opencode\engram-val\backup_full.py`. Parent directories verified with Test-Path; execution timeout 120 seconds; online SQLite backup opens the source read-only and launches no persistent subprocesses.
- Pre-mutation backup: `C:\Users\Auxiliar\.engram\backups\engram-DB-full-20261001-160242.sqlite3`; observations **20869**, sessions **746**, prompts in `user_prompts` **4405**. Script copy counts reconciled with source and reported usable; this schema has no `prompts` table. Non-empty topic keys: **20118**. No lossy export used.
- Completed: bounded source/config inspection, requirements clarification recorded, three pending tasks, runner inventory, backup, and this tracker. Full-mirror persistence/readback is checked separately before the preparation reply; it never counts as application delivery.
- Current remaining work: T2 regressions, T4 source-faithful examples/prints, current checks/full mirror, and T3 independent Playwright acceptance. Implementation is authorized; TDD remains unconfirmed. No commits.
