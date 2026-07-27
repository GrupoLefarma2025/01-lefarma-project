# Gastos App Specification

## Purpose

Define the Gastos application mounted as a subtree under `/CxP/gastos/`: its Dashboard landing, three-step login, cross-app single sign-on, and the reusable route module shared with the root build. This is the first app mounted under the corrected navigation model.

## Requirements

### Requirement: Gastos Subtree Mounting

The Gastos app SHALL be mounted as a route subtree at `/CxP/gastos/`. Gastos routes SHALL resolve as `/CxP/gastos/{child}`. The subtree SHALL keep its own main layout and SHALL NOT reuse the shell layout.

#### Scenario: Subtree routes resolve under the prefix

- GIVEN the shell build served under `/CxP/`
- WHEN a user navigates to `/CxP/gastos/dashboard`
- THEN the route resolves within the subtree without the shell layout

#### Scenario: Unauthenticated index redirects to Gastos login

- GIVEN an unauthenticated user navigating to `/CxP/gastos/`
- WHEN the subtree evaluates the session
- THEN the user is redirected to `/CxP/gastos/login` with the destination preserved

### Requirement: Gastos Dashboard Landing

For authenticated users, the subtree index `/CxP/gastos/` SHALL land directly on the Dashboard. Authentication SHALL be the sole gate; empresa/sucursal/area context SHALL NOT be required to reach the Dashboard.

#### Scenario: Authenticated user lands on Dashboard

- GIVEN an authenticated user navigating to `/CxP/gastos/`
- WHEN the subtree index resolves
- THEN the Dashboard renders immediately with no launcher or context prompt

#### Scenario: Unauthenticated user does not reach Dashboard

- GIVEN an unauthenticated user navigating to `/CxP/gastos/dashboard`
- WHEN the guard evaluates the session
- THEN the user is redirected to `/CxP/gastos/login` and the Dashboard is not rendered

### Requirement: Gastos Three-Step Login

The Gastos login at `/CxP/gastos/login` SHALL collect credentials (step 1), password plus domain (step 2), and empresa/sucursal/area context (step 3). Step 3 SHALL be presented only in the Gastos login flow. The session SHALL NOT be finalized for Gastos until step 3 completes.

#### Scenario: Full three-step flow grants access

- GIVEN an unauthenticated user at `/CxP/gastos/login`
- WHEN the user completes steps 1, 2, and 3
- THEN the session is authenticated with context and the user is redirected to the Dashboard

#### Scenario: Gastos login presents context selection

- GIVEN an unauthenticated user at `/CxP/gastos/login`
- WHEN the credential and password steps are completed
- THEN the empresa/sucursal/area step is presented before the session is finalized

#### Scenario: Global login cleanly skips context selection

- GIVEN an unauthenticated user at the global `/CxP/login`
- WHEN the credential and password steps are completed
- THEN the context-selection step is cleanly skipped with no intermediate partial state

### Requirement: Cross-App Single Sign-On

Within the shell build (single origin), Gastos SHALL share the authenticated session established by the global login or any other app. Navigating from `/CxP/hub` to `/CxP/gastos/` SHALL NOT require re-authentication when a valid session exists.

#### Scenario: SSO from hub to Gastos

- GIVEN an authenticated user at `/CxP/hub`
- WHEN the user navigates to `/CxP/gastos/`
- THEN the Dashboard renders without a login prompt or credential request

### Requirement: GastosRoutes Module Reuse

The Gastos route table SHALL be defined once in a reusable module mounted in BOTH the root build and the shell subtree. Root-build behavior SHALL remain unchanged, including its existing unauthenticated landing surface.

#### Scenario: Root build unchanged

- GIVEN the root build served at the root origin
- WHEN the reusable Gastos route module is mounted at root
- THEN every existing root URL resolves exactly as before, with its existing landing surface

#### Scenario: Shell subtree resolves the same module

- GIVEN the shell build served under `/CxP/`
- WHEN the same module is mounted under `gastos`
- THEN each route resolves as `/CxP/gastos/{child}` using identical module content
