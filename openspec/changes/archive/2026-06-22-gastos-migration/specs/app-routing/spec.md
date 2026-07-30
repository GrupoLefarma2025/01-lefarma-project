# Delta for App Routing

## ADDED Requirements

### Requirement: Root Index Redirect

The `/CxP/` index route SHALL redirect instead of rendering a home surface: unauthenticated users to the global login, authenticated users to the hub.

#### Scenario: Unauthenticated index redirects to global login

- GIVEN an unauthenticated user navigating to `/CxP/`
- WHEN the index route resolves
- THEN the user is redirected to `/CxP/login` with no home content rendered

#### Scenario: Authenticated index redirects to hub

- GIVEN an authenticated user navigating to `/CxP/`
- WHEN the index route resolves
- THEN the user is redirected to `/CxP/hub` with no home content rendered

### Requirement: Global Login Route

The shell SHALL expose a global login at `/CxP/login` that authenticates credentials and password plus domain only. It SHALL NOT present empresa/sucursal/area context selection and SHALL redirect to the hub on success.

#### Scenario: Global login redirects to hub on success

- GIVEN an unauthenticated user at `/CxP/login`
- WHEN the credential and password steps are completed
- THEN the user is redirected to `/CxP/hub` without context selection

### Requirement: Per-App Login Route Pattern

Each mounted app subtree SHALL expose its own login at `/CxP/{app}/login`, independent of the global login. Per-app logins MAY collect app-specific context beyond credentials.

#### Scenario: App login is addressable per app

- GIVEN the Gastos subtree mounted under `/CxP/gastos/`
- WHEN an unauthenticated user navigates to `/CxP/gastos/login`
- THEN the Gastos login renders, distinct from the global login at `/CxP/login`

## MODIFIED Requirements

### Requirement: Authentication Guard

A `RequireAuth` guard SHALL protect shell and subtree routes, redirecting unauthenticated sessions to the subtree-appropriate login destination while preserving the return URL. The destination SHALL be configurable per subtree (shell to the global login, a mounted app to its own login). The guard SHALL check authentication only and SHALL NOT block on empresa/sucursal/area context selection.
(Previously: Redirected to a single login destination; now subtree-aware, auth-only checking preserved.)

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

- GIVEN route-level permission checks that wrap Gastos routes in the root build
- WHEN the same routes are mounted under the `/CxP/gastos/` subtree
- THEN the permission checks still evaluate against the authenticated session, with no behavior silently bypassed

### Requirement: Static App Registry

The apps available in the shell SHALL be declared by a static, code-level registry module, and the shell SHALL NOT query backend permissions to build the launcher list. The `gastos` entry SHALL be enabled and SHALL appear in the launcher.
(Previously: Gastos was disabled; now enabled and launchable.)

#### Scenario: Launcher reads from the static registry

- GIVEN the static app registry module
- WHEN the shell renders the launcher
- THEN the displayed apps match the registry entries exactly with no backend call to populate the list

#### Scenario: Adding an app entry is code-only

- GIVEN a developer adding a new entry to the static registry
- WHEN the shell next renders
- THEN the new app appears in the launcher without shell code changes

#### Scenario: Gastos appears in the launcher

- GIVEN the registry with the `gastos` entry enabled
- WHEN an authenticated user opens the hub
- THEN the launcher renders a Gastos entry that navigates to `/CxP/gastos/`

### Requirement: App Subtree Mounting

The routing capability SHALL support mounting an app subtree under the prefix without modifying the shell layout or guard logic. The Gastos subtree at `/CxP/gastos/` SHALL be the first concrete mounted app.
(Previously: Mounting was described as a future capability; it is now live with Gastos mounted.)

#### Scenario: Gastos subtree is addressable

- GIVEN the Gastos subtree registered under `/CxP/gastos/`
- WHEN a user navigates to a route inside that subtree
- THEN routing resolves within the subtree with the shell layout and guard unchanged

### Requirement: `/CxP/` Deployment Prefix

The SPA SHALL be deployable under the `/CxP/` IIS virtual application prefix. Built asset URLs SHALL resolve relative to `/CxP/`, and client-side routing SHALL treat `/CxP/` as the route root.
(Previously: /CxP/ was the shell Home launcher; now it is a redirect — shell home moved to /CxP/hub.)

#### Scenario: Built assets use the prefix

- GIVEN a production build of the SPA
- WHEN the build output is served from the `/CxP/` virtual application
- THEN every referenced asset URL begins with `/CxP/`
- AND deep links reload correctly without 404 on refresh

#### Scenario: Router treats prefix as root

- GIVEN the SPA loaded at `/CxP/`
- WHEN the router resolves the active route
- THEN the prefix `/CxP/` still reaches the SPA and the router treats it as the route root
- AND the index `/CxP/` is a redirect, not the home surface
- AND child routes resolve as `/CxP/{child}`
- AND the shell home is `/CxP/hub`
