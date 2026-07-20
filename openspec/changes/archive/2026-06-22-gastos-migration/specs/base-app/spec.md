# Delta for Base App

## MODIFIED Requirements

### Requirement: Authenticated Shell Layout

The base app SHALL render a shell layout containing primary navigation and a content region. The shell SHALL be reachable only to authenticated users via the `RequireAuth` guard. The shell home SHALL be the hub at `/CxP/hub`; the `/CxP/` index SHALL be a redirect and SHALL NOT render a home surface.
(Previously: Shell home was the `/CxP/` index; now the index redirects and the shell home is `/CxP/hub`.)

#### Scenario: Authenticated user sees the shell at the hub

- GIVEN an authenticated user navigating to `/CxP/hub`
- WHEN the shell renders
- THEN the layout shows the primary navigation and a content region
- AND the home launcher is displayed in the content region

#### Scenario: Unauthenticated user does not reach the shell

- GIVEN an unauthenticated user navigating to `/CxP/hub`
- WHEN the request is evaluated by `RequireAuth`
- THEN the user is redirected to the global login
- AND the shell content is not rendered

#### Scenario: Index route is not a home surface

- GIVEN the shell build with the corrected navigation
- WHEN a user navigates to `/CxP/`
- THEN the route redirects rather than rendering the shell
- AND the shell layout is not mounted at the index

### Requirement: Home Launcher

The shell home at `/CxP/hub` SHALL display a launcher listing the apps declared in the static app registry. The launcher SHALL be the default landing surface of the shell for authenticated users arriving from the global login or the `/CxP/` redirect.
(Previously: Launcher was the default landing at the `/CxP/` index; it now lives at `/CxP/hub`.)

#### Scenario: Launcher lists registry apps

- GIVEN the static app registry contains N entries
- WHEN an authenticated user opens `/CxP/hub`
- THEN the launcher renders one entry per registry item
- AND each entry exposes a way to navigate to that app

#### Scenario: Empty registry renders gracefully

- GIVEN a static registry with zero entries
- WHEN the home renders
- THEN the launcher shows an empty state
- AND the shell layout remains intact

#### Scenario: Global login lands on the launcher

- GIVEN an authenticated user completing the global login at `/CxP/login`
- WHEN the redirect resolves
- THEN the user arrives at `/CxP/hub`
- AND the launcher renders as the default landing surface
