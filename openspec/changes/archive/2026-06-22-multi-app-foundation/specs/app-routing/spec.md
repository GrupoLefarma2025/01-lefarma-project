# App Routing Specification

## Purpose

Define how the Lefarma SPA is served and routed as a multi-app platform under a single `/CxP/` deployment prefix (an IIS virtual application, confirmed by ops). This capability covers the Vite asset base, the React Router 7 basename, an authentication guard, the static app registry, and the ability to mount additional app subtrees without modifying the shell.

## Requirements

### Requirement: `/CxP/` Deployment Prefix

The SPA SHALL be deployable under the `/CxP/` IIS virtual application prefix. Built asset URLs SHALL resolve relative to `/CxP/`, and client-side routing SHALL treat `/CxP/` as the route root.

#### Scenario: Built assets use the prefix

- GIVEN a production build of the SPA
- WHEN the build output is served from the `/CxP/` virtual application
- THEN every referenced asset URL begins with `/CxP/`
- AND deep links reload correctly without 404 on refresh

#### Scenario: Router treats prefix as root

- GIVEN the SPA loaded at `/CxP/`
- WHEN the router resolves the active route
- THEN the shell home path is `/CxP/`
- AND child routes resolve as `/CxP/{child}`

### Requirement: Authentication Guard

A `RequireAuth` route guard SHALL protect shell routes. It SHALL distinguish authenticated from unauthenticated sessions and redirect accordingly while preserving the intended destination.

#### Scenario: Unauthenticated user is redirected to login

- GIVEN an unauthenticated user navigating to a protected route
- WHEN the guard evaluates the session
- THEN the user is redirected to the login destination
- AND the return URL of the protected route is preserved for post-login redirect

#### Scenario: Authenticated user passes through

- GIVEN an authenticated user navigating to a protected route
- WHEN the guard evaluates the session
- THEN the user proceeds to the requested route
- AND no redirect occurs

#### Scenario: Guard checks authentication, not context selection

- GIVEN a session that is authenticated but has no empresa/sucursal/area context selected
- WHEN the guard evaluates the session
- THEN the guard allows navigation
- AND does NOT block on context selection (deferred to per-app logic)

### Requirement: Static App Registry

The set of apps available in the shell SHALL be declared by a static, code-level registry module. The shell SHALL NOT query backend permissions to build the launcher list in this change.

#### Scenario: Launcher reads from the static registry

- GIVEN the static app registry module
- WHEN the shell renders the launcher
- THEN the displayed apps match the registry entries exactly
- AND no backend call is made to populate the list

#### Scenario: Adding an app entry is code-only

- GIVEN a developer adding a new entry to the static registry
- WHEN the shell next renders
- THEN the new app appears in the launcher without shell code changes

### Requirement: App Subtree Mounting

The routing capability SHALL support mounting an app subtree under the prefix (e.g., a future `/CxP/gastos/` or `/CxP/cxp/`) without modifying the shell layout or guard logic.

#### Scenario: Future app subtree is addressable

- GIVEN a new app subtree registered under the prefix
- WHEN a user navigates to a route inside that subtree
- THEN routing resolves within the subtree
- AND the shell and guard remain unchanged

### Requirement: Gastos Backward Compatibility

The existing Gastos app SHALL continue to render and authenticate at its current route during this change. Moving Gastos under `/CxP/gastos/` is out of scope.

#### Scenario: Gastos route unchanged

- GIVEN the current Gastos entry route
- WHEN a user navigates to it after this change
- THEN Gastos renders and authenticates as before
