# Base App Specification

> Updated by nav-reorg: shell moved to root, Gastos renamed CxP, paths adjusted.

## Purpose

Define the minimum shell application that hosts the launcher and profile served from the root (`/`) path. This capability covers the authenticated layout, the home launcher driven by the static app registry, and the profile page. It explicitly excludes any user/role administration UI, which remains in its current location and is not relocated in this change.

## Requirements

### Requirement: Authenticated Shell Layout

The base app SHALL render a shell layout containing primary navigation and a content region. The shell SHALL be reachable only to authenticated users via the `RequireAuth` guard. The shell home SHALL be the hub at `/hub`; the `/` index SHALL be a redirect and SHALL NOT render a home surface.

#### Scenario: Authenticated user sees the shell at the hub

- GIVEN an authenticated user navigating to `/hub`
- WHEN the shell renders
- THEN the layout shows the primary navigation and a content region
- AND the home launcher is displayed in the content region

#### Scenario: Unauthenticated user does not reach the shell

- GIVEN an unauthenticated user navigating to `/hub`
- WHEN the request is evaluated by `RequireAuth`
- THEN the user is redirected to the global login
- AND the shell content is not rendered

#### Scenario: Index route is not a home surface

- GIVEN the shell build with the corrected navigation
- WHEN a user navigates to `/`
- THEN the route redirects rather than rendering the shell
- AND the shell layout is not mounted at the index

### Requirement: Home Launcher

The shell home at `/hub` SHALL display a launcher listing the apps declared in the static app registry. The launcher SHALL be the default landing surface of the shell for authenticated users arriving from the global login or the `/` redirect.

#### Scenario: Launcher lists registry apps

- GIVEN the static app registry contains N entries
- WHEN an authenticated user opens `/hub`
- THEN the launcher renders one entry per registry item
- AND each entry exposes a way to navigate to that app

#### Scenario: Empty registry renders gracefully

- GIVEN a static registry with zero entries
- WHEN the home renders
- THEN the launcher shows an empty state
- AND the shell layout remains intact

#### Scenario: Global login lands on the launcher

- GIVEN an authenticated user completing the global login at `/login`
- WHEN the redirect resolves
- THEN the user arrives at `/hub`
- AND the launcher renders as the default landing surface

### Requirement: Profile Page

The shell SHALL provide a profile page that renders for authenticated users.

#### Scenario: Authenticated user opens profile

- GIVEN an authenticated user in the shell
- WHEN the user navigates to the profile route
- THEN the profile page renders
- AND the shell layout remains present

### Requirement: Excludes Administration UI

The base app SHALL NOT include user, role, or permission administration surfaces. The existing admin UI SHALL remain at its current location and is NOT relocated in this change.

#### Scenario: Admin remains outside the shell

- GIVEN the base app shell deployed under `/`
- WHEN a user inspects the shell routes
- THEN no admin route is present under the shell
- AND the existing admin entry point is unchanged

### Requirement: No Global Context Assumption

The base app SHALL NOT assume that an empresa/sucursal/area context is selected for the shell to render. Context-dependent behavior is deferred to individual apps.

#### Scenario: Shell renders without context selection

- GIVEN an authenticated session with no context selection
- WHEN the user opens the shell home
- THEN the shell and launcher render
- AND no error or blocking prompt is shown for missing context
