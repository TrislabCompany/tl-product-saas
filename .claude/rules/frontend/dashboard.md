---
paths:
  - "clients/dashboard/**"
---

# Frontend — dashboard app (`clients/dashboard`)

Tenant-facing application. Read `frontend/shared.md` first; this file is only the divergences.

- **Port** 5174 · dev proxy target `https://localhost:7030` (HTTPS, with `ws: true` for the SignalR hub) · localStorage prefix `tl.dashboard.*` · login header `X-Trislab-App: dashboard`.
- **Env** (`src/env.ts`): `{ apiBase, defaultTenant, demoMode }`.
- Dev-proxy is HTTPS on purpose: routing the bearer token through an HTTP→HTTPS 307 redirect stripped the `Authorization` header.

## No RHF/zod — hand-rolled forms

The dashboard does **not** depend on react-hook-form or zod. Use controlled inputs + local state. Don't add those deps to match admin.

## Permissions — fetched, not in the JWT

The JWT carries **only role names**. `auth-context.tsx` fetches the effective permission list from `GET /api/v1/identity/permissions` (`getMyPermissions()` in `src/api/identity.ts`), caches it in `tokenStore` under `tl.dashboard.permissions`, and exposes a `permissionsHydrated` flag so gated UI doesn't flash while the fetch is in flight (re-fetched on login/impersonation swaps; `refreshPermissions()` for role changes). Nav items are gated via `perm`/`anyPerm` in `src/components/layout/nav-data.ts`, and every route behind a permission takes the same gate: `guarded(navGate("/path"), <Page />)` in `src/routes.tsx` wraps it in `RouteGuard` (`src/auth/route-guard.tsx`), which shows a quiet status while `!permissionsHydrated` and the 403 view (`ForbiddenView`) without the permission. A page opens exactly when its menu item shows; `navGate` throws for a path without a menu item. `ProtectedRoute` stays auth-only. Playwright: a spec that opens a gated page mocks `GET /identity/permissions` with its grants (`tests/layout/route-guards.spec.ts`).

A query that mounts outside its own nav-gated page (topbar badges, overview cards) must set `enabled: permissionsHydrated && user.permissions.includes(<the endpoint's RequirePermission>)` and hide or replace its UI without it; otherwise every poll is a 403 the API logs as an error. `refetch()` ignores `enabled`, so gate manual refetches too. Playwright: `installShellMocks` grants `SHELL_PERMISSIONS` (the Basic-role grants these queries need); specs testing the missing-permission path re-mock `/identity/permissions`.

## Routing & realtime/SSE

- Every route element is wrapped in `withSuspense(node)` (per-route skeleton fallback). No per-route permission guards.
- `RealtimeProvider` **and** `SseProvider` are mounted inside `AppShell` (authenticated routes only), under a `CommandPaletteProvider` (cmdk).
- SignalR provider pre-wires ~11 chat/notification events.
- **SSE** (`src/sse/`, dashboard-only): two-step token — `POST /api/v1/sse/token`, then `GET /api/v1/sse/stream?token=<guid>` consumed via fetch streaming (`parseSseStream` async generator; EventSource can't send auth headers). **Two split contexts:** `useSseStatus()` (stable, for status dots) vs `useSseEvents()` (mutates per event) to avoid cascading re-renders; `useSse()` is the composite.

## Impersonation

`token-store.ts` has `beginImpersonation` / `endImpersonationWithFreshTokens` / `restoreStashedActor` that stash the operator's tokens under `tl.dashboard.impersonation.*`. `AuthProvider` exposes `beginImpersonation({ requestId })`/`stopImpersonation` and derives `ImpersonationInfo` from `act_sub` / `act_tenant` / `act_name` claims. Admin triggers the handoff one-way via its `dashboardUrl`.

Impersonation only reads and needs the user's approval (D-44): the framework refuses every write of an impersonation token except ending it (403 `Identity.ImpersonationReadOnly`), and the banner says so. A user's page requests access with a reason and, once the user approved, starts it (`pages/identity/user-detail.tsx`). `AccessRequestsNotice` (`components/layout/`, under the top bar) shows every request to impersonate the signed-in user (`GET /identity/impersonation/requests/mine`, `Impersonation.Respond`, a Basic grant): approve, deny, or take an approval back, which also ends the impersonation it started. It is hidden while impersonating.

## Performance

- `@tanstack/react-virtual` for long lists — use it for any large collection (chat history, big tables).
- `cmdk` powers the command palette.

## Theme

The Trislab theme of `framework-ui` (dark slate, the orange accent, Inter), with the starter's additions in `src/styles/starter/theme.css` and the product's look in `src/styles/theme.css` ([docs/theme.md](../../../docs/theme.md)). A user may swap the accent: `.accent-{rose,indigo,violet,sky,emerald,amber,custom}` on `<html>` sets the `--brand-*` stops, which replace `--primary` below `<body>`; "Default" is the theme's own colour (`--theme-primary`). Saffron is the warm second accent. No colour anywhere else.

## Add-a-page deltas (on top of shared steps)

- Hand-roll forms (no RHF/zod).
- Wrap the route element in `withSuspense(<X/>)`; no permission guard.
- If it consumes pushes: `useRealtimeEvent("EventName", handler)` (register the name in `realtime-context.tsx`) or `useSseEvents()` for SSE.
- Use `react-virtual` for long lists; keep neutrals chroma 0.
