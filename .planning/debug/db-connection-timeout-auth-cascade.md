---
status: investigating
trigger: "Database connection timeout causing auth cascade failure - TaskCanceledException at RelationalConnection.OpenInternalAsync"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:00:00Z
---

## Current Focus

hypothesis: CancellationToken from HTTP RequestAborted is the direct trigger for TaskCanceledException; root cause is SQL Server unreachable causing HTTP timeout cascade
test: Code analysis complete - all evidence gathered
expecting: Multi-layered issue spanning DB resilience, CancellationToken propagation, and frontend error handling
next_action: Report findings

## Symptoms

expected: When access token expires, frontend should silently refresh via /api/auth/refresh and continue seamlessly
actual: DB connection fails → refresh returns 500 → logout returns 500 → SSE retries with expired token → user gets stuck in 401 loop
errors: TaskCanceledException at RelationalConnection.OpenInternalAsync, lines 249 and 301 in TokenService.cs, line 530 in AuthService.cs
reproduction: Wait for access token to expire (60 min) while SQL Server (192.168.4.2) is unreachable or slow
started: Ongoing infrastructure issue - DB server intermittently unreachable

## Eliminated

(none - initial investigation)

## Evidence

### Evidence 1: Connection String Configuration
- timestamp: 2026-03-30
- checked: appsettings.json and appsettings.Development.json
- found: Connection Timeout=360 (6 minutes) for SQL Server at 192.168.4.2. Both DefaultConnection (Lefarma DB) and AsokamConnection point to same server.
- implication: Connection timeout is very high (360s) but applies only to initial connection opening, not command execution. If SQL Server is unreachable, connection attempts block for up to 6 minutes.

### Evidence 2: No Connection Resilience Configuration
- timestamp: 2026-03-30
- checked: Program.cs DbContext registration (lines 108-112)
- found: Basic `options.UseSqlServer(connectionString)` with NO EnableRetryOnFailure, NO command timeout, NO execution strategy, NO connection pooling configuration.
- implication: Zero resilience against transient DB failures. Any DB blip = immediate TaskCanceledException, no retries.

### Evidence 3: CancellationToken Source is HTTP RequestAborted
- timestamp: 2026-03-30
- checked: AuthController.cs - all action methods accept `CancellationToken cancellationToken` parameter
- found: ASP.NET Core automatically binds this to HttpContext.RequestAborted. When the client (axios with 30s timeout, or browser SSE timeout) disconnects, this token is cancelled. The TokenService methods (lines 249, 301) and AuthService (line 530) all pass this token to EF Core operations.
- implication: If the frontend gives up waiting (axios 30s timeout) before the DB operation completes (up to 360s connection timeout), the CancellationToken fires → TaskCanceledException at EF Core level.

### Evidence 4: TokenService Does NOT Differentiate Cancellation from DB Errors
- timestamp: 2026-03-30
- checked: TokenService.cs catch blocks (lines 279-283, 321-325)
- found: All DB methods use generic `catch (Exception ex)` which catches TaskCanceledException and returns `CommonErrors.InternalServerError()`. There is NO specific handling for OperationCanceledException/TaskCanceledException.
- implication: Cancellation is logged as a generic "Error validating refresh token" instead of being identified as a timeout/cancellation. Returns 500 to client instead of a more appropriate 503 or 408.

### Evidence 5: RefreshTokenAsync Makes 7+ Sequential DB Queries
- timestamp: 2026-03-30
- checked: AuthService.cs RefreshTokenAsync (lines 353-506)
- found: The refresh flow executes these sequential DB queries:
  1. ValidateRefreshTokenAsync → query RefreshTokens with Include(Usuario)
  2. SaveChangesAsync (mark token as used)
  3. FirstOrDefaultAsync on Usuarios
  4. FirstOrDefaultAsync on Sesiones
  5. ToListAsync on UsuariosRoles (with Include)
  6. ToListAsync on RolesPermisos (with Include)
  7. ToListAsync on UsuariosPermisos (with Include)
  8. RevokeRefreshTokenAsync → query + SaveChanges
  9. GenerateAccessTokenAsync (no DB)
  10. GenerateRefreshTokenAsync → SaveChanges
  11. Final SaveChangesAsync
  That's 11 DB operations, many sequential. With a struggling DB, this is a LOT of chances to fail.
- implication: Even if each query takes 3-5 seconds under DB stress, the total exceeds the frontend's 30s axios timeout.

### Evidence 6: Frontend Axios Timeout Mismatch
- timestamp: 2026-03-30
- checked: api.ts line 10
- found: Axios timeout is 30000ms (30 seconds). Backend connection timeout is 360000ms (360 seconds = 6 minutes).
- implication: Frontend will ALWAYS abandon the request before the backend gives up on the DB connection. This creates the CancellationToken cancellation cascade.

### Evidence 7: Frontend 401 Interceptor Has No Error Type Differentiation
- timestamp: 2026-03-30
- checked: api.ts lines 43-107
- found: On 401 → tries refresh. If refresh throws (any error, including 500 from DB timeout) → calls `useAuthStore.getState().logout()` → redirects to `/`. Does NOT distinguish between "refresh token is genuinely invalid" vs "server is temporarily down".
- implication: Any transient DB failure during refresh = forced logout. No retry, no "server temporarily unavailable" message. User loses their session.

### Evidence 8: SSE Retry Logic Uses Stale Token
- timestamp: 2026-03-30
- checked: useNotifications.ts lines 178-217
- found: `connect()` reads token from `useAuthStore.getState().token` at connection time. If the access token expires while SSE is connected, the SSE reconnect will use the same expired token. The SSE endpoint (NotificationStreamController line 75) validates this token, and on expiry returns 401. The EventSource native `onerror` fires, triggering handleError which retries up to 3 times with exponential backoff (1s, 2s, 3s).
- implication: After access token expires, SSE retries 3 times with expired token (each getting 401), then force-logs out the user. No attempt to refresh the token before SSE reconnect.

### Evidence 9: No Global Exception Handler for TaskCanceledException
- timestamp: 2026-03-30
- checked: Program.cs middleware pipeline
- found: No UseExceptionHandler(), no UseDeveloperExceptionPage(), no ProblemDetails. Only WideEventLoggingMiddleware which catches exceptions for logging but re-throws. No global filter converts TaskCanceledException to 503.
- implication: TaskCanceledException from EF Core propagates through the generic `catch (Exception ex)` in services → becomes a 500 Internal Server Error via ErrorOr pattern.

### Evidence 10: RefreshToken Flow Passes Same CancellationToken to Multiple Operations
- timestamp: 2026-03-30
- checked: AuthService.cs lines 360-471
- found: The same `cancellationToken` (from HTTP RequestAborted) is passed to ALL 11 DB operations in the refresh flow. If any one operation is slow enough for the client to disconnect, ALL remaining operations will also fail with the same cancellation.
- implication: One slow query kills the entire multi-step refresh operation.

## Resolution

root_cause: Multi-layered:
  1. PRIMARY: No DB connection resilience (no EnableRetryOnFailure, no execution strategy)
  2. TRIGGER: Frontend axios 30s timeout < Backend 360s connection timeout → client disconnect cancels the DB operation via RequestAborted CancellationToken
  3. CASCADE: TokenService/AuthService catch TaskCanceledException as generic Exception → return 500 instead of 503 → frontend treats as "session invalid" → forces logout
  4. AMPLIFIER: RefreshTokenAsync makes 11 sequential DB queries, each a failure point under DB stress
  5. SSE LOOP: SSE reconnects with expired token (no token refresh before reconnect) → 3 retries fail → force logout

fix: (not applied - research only)
files_changed: []
