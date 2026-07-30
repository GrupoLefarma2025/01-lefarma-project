# Frontend Test Infrastructure Specification

## Purpose

Establish a repeatable frontend test runner so behavior can be locked before refactors. This capability provides the test environment, the `npm test` entry point, and initial smoke coverage for authentication and the existing Gastos dashboard. It is a prerequisite for safe code relocation in later phases of the multi-app foundation.

## Requirements

### Requirement: Test Runner Entry Point

The project SHALL expose a `npm test` script that executes the frontend test suite from the command line and reports pass/fail results to the console.

#### Scenario: Engineer runs the suite from CLI

- GIVEN a clean checkout of the frontend project
- WHEN the engineer runs `npm test`
- THEN the runner executes all discovered test files
- AND exits non-zero when any test fails

#### Scenario: Watch mode available

- GIVEN an engineer iterating on a component
- WHEN the engineer runs the documented watch command
- THEN the runner re-runs affected tests on file change
- AND does not require restarting the dev server

### Requirement: Component Test Environment

The test environment SHALL support rendering React 19 components against a browser-like DOM so that React Testing Library queries can assert on rendered output. No real browser process SHALL be launched.

#### Scenario: React component renders under test

- GIVEN a test that renders a React component using the project's testing utilities
- WHEN the test queries the rendered DOM by role, text, or label
- THEN the query resolves against the in-memory DOM
- AND no real browser process is launched

### Requirement: API Independence

Frontend tests SHALL NOT require a running backend service. Network calls made during tests SHALL be intercepted or mocked at the test boundary.

#### Scenario: Test runs with backend offline

- GIVEN the test suite and no backend reachable at the API origin
- WHEN the engineer runs `npm test`
- THEN all tests complete deterministically
- AND no test fails solely because a network request could not reach the backend

### Requirement: Initial Smoke Coverage

The repository SHALL include at least two smoke tests that lock current behavior: one covering the login flow, one covering the Gastos dashboard rendering.

#### Scenario: Login smoke test

- GIVEN the login smoke test in the suite
- WHEN the suite runs
- THEN the test asserts the login form renders and accepts credentials
- AND verifies the expected success path against mocked authentication

#### Scenario: Gastos dashboard smoke test

- GIVEN the Gastos dashboard smoke test in the suite
- WHEN the suite runs
- THEN the test asserts the dashboard renders its primary surface
- AND does not depend on live API data

### Requirement: Build and Lint Preservation

The addition of test tooling SHALL NOT regress existing scripts. `npm run build` and `npm run lint` SHALL remain green under the project's current strict lint policy (`--max-warnings 0`).

#### Scenario: Existing scripts still pass

- GIVEN the test tooling installed and configured
- WHEN the engineer runs `npm run build` followed by `npm run lint`
- THEN both commands exit zero
- AND lint reports zero warnings
