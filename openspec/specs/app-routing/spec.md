# App Routing Specification

> Updated by nav-reorg: shell moved to root, Gastos renamed CxP, paths adjusted.

## Purpose

Define how the Lefarma SPA is served and routed as a multi-app platform served from the root (`/`) deployment path. This capability covers the Vite asset base, the React Router 7 basename, an authentication guard, the static app registry, and the ability to mount additional app subtrees without modifying the shell.

## Requirements

### Requirement: Root Deployment Path

The SPA SHALL be deployable from the root path (`/`). Built asset URLs SHALL resolve relative to `/`, and client-side routing SHALL treat `/` as the route root.

#### Scenario: Built assets use the root path

- GIVEN a production build of the SPA
- WHEN the build output is served from the root path
- THEN every referenced asset URL begins with `/assets/`
- AND deep links reload correctly without 404 on refresh

#### Scenario: Router treats root as the route root

- GIVEN the SPA loaded at `/`
- WHEN the router resolves the active route
- THEN the root path `/` reaches the SPA and the router treats it as the route root
- AND the index `/` is a redirect, not the home surface
- AND child routes resolve as `/{child}`
- AND the shell home is `/hub`

### Requirement: Authentication Guard

A `RequireAuth` guard SHALL protect shell and subtree routes, redirecting unauthenticated sessions to the subtree-appropriate login destination while preserving the return URL. The destination SHALL be configurable per subtree (shell to the global login, a mounted app to its own login). The guard SHALL check authentication only and SHALL NOT block on empresa/sucursal/area context selection.

#### Scenario: Unauthenticated user is redirected to the subtree login

- GIVEN an unauthenticated user navigating to a protected route
- WHEN the guard evaluates the session
- THEN the user is redirected to the login destination configured for that subtree with the return URL preserved

#### Scenario: Authenticated user passes through

- GIVEN an authenticated user navigating to a protected route
- WHEN the guard evaluates the session
- THEN the user proceeds to the requested route with no redirect

#### Scenario: Guard checks authentication, not context selection

- GIVEN a session that is authenticated but has no empresa/sucursal/area context selected
- WHEN the guard evaluates the session
- THEN the guard allows navigation and does NOT block on context selection (deferred to per-app logic)

#### Scenario: Permission checks preserved under subtree mounting

- GIVEN route-level permission checks that wrap CxP routes
- WHEN the same routes are mounted under the `/cxp/` subtree
- THEN the permission checks still evaluate against the authenticated session, with no behavior silently bypassed

### Requirement: Static App Registry

The apps available in the shell SHALL be declared by a static, code-level registry module, and the shell SHALL NOT query backend permissions to build the launcher list. The `cxp` and `rh` entries SHALL be enabled and SHALL appear in the launcher.

#### Scenario: Launcher reads from the static registry

- GIVEN the static app registry module
- WHEN the shell renders the launcher
- THEN the displayed apps match the registry entries exactly with no backend call to populate the list

#### Scenario: Adding an app entry is code-only

- GIVEN a developer adding a new entry to the static registry
- WHEN the shell next renders
- THEN the new app appears in the launcher without shell code changes

#### Scenario: CxP appears in the launcher

- GIVEN the registry with the `cxp` entry enabled
- WHEN an authenticated user opens the hub
- THEN the launcher renders a CxP entry that navigates to `/cxp/`

### Requirement: App Subtree Mounting

The routing capability SHALL support mounting an app subtree under a root-relative prefix without modifying the shell layout or guard logic. The CxP subtree at `/cxp/` SHALL be the first concrete mounted app. The RH subtree at `/rh/` is the second.

#### Scenario: CxP subtree is addressable

- GIVEN the CxP subtree registered under `/cxp/`
- WHEN a user navigates to a route inside that subtree
- THEN routing resolves within the subtree with the shell layout and guard unchanged

### Requirement: Root Index Redirect

The `/` index route SHALL redirect instead of rendering a home surface: unauthenticated users to the global login, authenticated users to the hub.

#### Scenario: Unauthenticated index redirects to global login

- GIVEN an unauthenticated user navigating to `/`
- WHEN the index route resolves
- THEN the user is redirected to `/login` with no home content rendered

#### Scenario: Authenticated index redirects to hub

- GIVEN an authenticated user navigating to `/`
- WHEN the index route resolves
- THEN the user is redirected to `/hub` with no home content rendered

### Requirement: Global Login Route

The shell SHALL expose a global login at `/login` that authenticates credentials and password plus domain only. It SHALL NOT present empresa/sucursal/area context selection and SHALL redirect to the hub on success.

#### Scenario: Global login redirects to hub on success

- GIVEN an unauthenticated user at `/login`
- WHEN the credential and password steps are completed
- THEN the user is redirected to `/hub` without context selection

### Requirement: Per-App Login Route Pattern

Each mounted app subtree SHALL expose its own login at `/{app}/login`, independent of the global login. Per-app logins MAY collect app-specific context beyond credentials.

#### Scenario: App login is addressable per app

- GIVEN the CxP subtree mounted under `/cxp/`
- WHEN an unauthenticated user navigates to `/cxp/login`
- THEN the CxP login renders, distinct from the global login at `/login`
