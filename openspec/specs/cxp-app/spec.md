# CxP App Specification

> Updated by nav-reorg: shell moved to root, Gastos renamed CxP, paths adjusted.

## Purpose

Define the CxP (Cuentas por Pagar) application mounted as a subtree under `/cxp/`: its Dashboard landing, three-step login, cross-app single sign-on, and the reusable route module. This is the first app mounted under the corrected navigation model. CxP is the ONLY app that collects empresa/sucursal/area context (step 3 of the login flow).

## Requirements

### Requirement: CxP Subtree Mounting

The CxP app SHALL be mounted as a route subtree at `/cxp/`. CxP routes SHALL resolve as `/cxp/{child}`. The subtree SHALL keep its own main layout and SHALL NOT reuse the shell layout.

#### Scenario: Subtree routes resolve under the prefix

- GIVEN the shell build served under `/`
- WHEN a user navigates to `/cxp/dashboard`
- THEN the route resolves within the subtree without the shell layout

#### Scenario: Unauthenticated index redirects to CxP login

- GIVEN an unauthenticated user navigating to `/cxp/`
- WHEN the subtree evaluates the session
- THEN the user is redirected to `/cxp/login` with the destination preserved

### Requirement: CxP Dashboard Landing

For authenticated users, the subtree index `/cxp/` SHALL land directly on the Dashboard. Authentication SHALL be the sole gate; empresa/sucursal/area context SHALL NOT be required to reach the Dashboard.

#### Scenario: Authenticated user lands on Dashboard

- GIVEN an authenticated user navigating to `/cxp/`
- WHEN the subtree index resolves
- THEN the Dashboard renders immediately with no launcher or context prompt

#### Scenario: Unauthenticated user does not reach Dashboard

- GIVEN an unauthenticated user navigating to `/cxp/dashboard`
- WHEN the guard evaluates the session
- THEN the user is redirected to `/cxp/login` and the Dashboard is not rendered

### Requirement: CxP Three-Step Login

The CxP login at `/cxp/login` SHALL collect credentials (step 1), password plus domain (step 2), and empresa/sucursal/area context (step 3). Step 3 SHALL be presented only in the CxP login flow. The session SHALL NOT be finalized for CxP until step 3 completes.

#### Scenario: Full three-step flow grants access

- GIVEN an unauthenticated user at `/cxp/login`
- WHEN the user completes steps 1, 2, and 3
- THEN the session is authenticated with context and the user is redirected to the Dashboard

#### Scenario: CxP login presents context selection

- GIVEN an unauthenticated user at `/cxp/login`
- WHEN the credential and password steps are completed
- THEN the empresa/sucursal/area step is presented before the session is finalized

#### Scenario: Global login cleanly skips context selection

- GIVEN an unauthenticated user at the global `/login`
- WHEN the credential and password steps are completed
- THEN the context-selection step is cleanly skipped with no intermediate partial state

### Requirement: Cross-App Single Sign-On

Within the shell build (single origin), CxP SHALL share the authenticated session established by the global login or any other app. Navigating from `/hub` to `/cxp/` SHALL NOT require re-authentication when a valid session exists.

#### Scenario: SSO from hub to CxP

- GIVEN an authenticated user at `/hub`
- WHEN the user navigates to `/cxp/`
- THEN the Dashboard renders without a login prompt or credential request

### Requirement: CxpRoutes Module Reuse

The CxP route table SHALL be defined once in a reusable module. The shell subtree mounts it under the `cxp` path wrapper. All route paths are RELATIVE so the same module content resolves correctly within the subtree.
