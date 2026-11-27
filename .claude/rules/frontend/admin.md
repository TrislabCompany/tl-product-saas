---
paths:
  - "clients/admin/**"
---

# Frontend — admin app (`clients/admin`)

Operator/SuperAdmin-facing console. Read `frontend/shared.md` first; this file is only the divergences.

- **Port** 5173 · dev proxy target `http://localhost:5030` (HTTP) · localStorage prefix `tl.admin.*` · login header `X-Trislab-App: admin`.
- **Env** (`src/env.ts`): `{ apiBase, defaultTenant, dashboardUrl }`. `dashboardUrl` is used for the one-way impersonation handoff into the dashboard app.

## Forms — react-hook-form + zod

Admin is the **only** app with `react-hook-form` + `zod` + `@hookform/resolvers`. Use them:

```ts
const form = useForm<Schema>({ resolver: zodResolver(schema) });
```

Form layout primitives live in `src/components/list/` (`PageHeader`, `Field`, `FormShell`, `FormSection`, `FormActions`, `Pagination`, `ErrorBand`).

## Permissions — fetched, hydrated, gated

- The JWT carries only role names. Admin fetches the permission set separately: `GET /api/v1/identity/permissions` (`getMyPermissions`), cached under `tl.admin.permissions`.
- `AuthProvider` hydrates them in an effect keyed on subject change and exposes `permissionsHydrated` to avoid a 403 flash on first paint.
- **Route gating:** wrap gated route elements in `<RouteGuard perms={[IdentityPermissions.Users.View]}>…</RouteGuard>`. It renders a "Resolving permissions" state while `!permissionsHydrated`, else `<ForbiddenView missing={…}/>`. (`ProtectedRoute` also accepts a `permissions?` prop.)
- **Looking into a tenant:** an operator's session is in root. A card on a tenant's page sends that tenant in the `tenant` header (`searchUsers({ tenantId })`, `getUserRoles(id, tenantId)`, `getTenantTheme(tenantId)`), which the framework scopes to that tenant for root operators only, with the operator's own permissions. **The operator only reads inside a tenant (D-44):** the framework refuses every write sent with the header (403 `Multitenancy.RootReadOnly`), so no card on a tenant's page writes. A change to a tenant's users, roles or branding is its Admins' job, in the dashboard.
- **The operator's writes on a tenant** are the root endpoints on the tenant record (activation, retry provisioning, renew, adjust validity) and "Restore admin access" (`RestoreAdminDialog`, `POST /api/v1/identity/tenants/{id}/restore-admin`, `Users.RestoreAdmin`): an address becomes the tenant's Admin again, its active Admins are e-mailed, and it is audited.
- **Impersonation only reads and needs the user's approval (D-44).** The impersonate dialog sends a request with a reason (`requestImpersonation`); the user approves or denies it in the dashboard; `AccessRequestsCard` on the tenant's page starts an approved request once (`startImpersonation({ requestId })`) and hands the token to the dashboard (`lib/impersonation-handoff.ts`). There is no re-open: a new session needs a new approved request.
- **Mirror server permissions by hand** in `src/lib/permissions.ts` (`IdentityPermissions`, `MultitenancyPermissions`, … frozen objects + `PERMISSION_CATALOG` driving the role editor). There is intentionally **no** runtime catalog fetch — when the server adds a permission, mirror the constant here.

## Routing & realtime

- Routes wrap elements in `<RouteGuard perms={…}>` (no per-route Suspense wrapper).
- `RealtimeProvider` is mounted in `App.tsx` and wires only `["NotificationCreated"]`.

## Theme

The Trislab theme of `framework-ui` (dark slate, the orange accent, Inter), with the starter's additions in `src/styles/starter/theme.css` and the product's look in `src/styles/theme.css` ([docs/theme.md](../../../docs/theme.md)). `--color-accent-signal` is the primary colour. No colour anywhere else.

## Add-a-page deltas (on top of shared steps)

- Use RHF + zod for any form.
- If the endpoint requires a permission, mirror the constant in `src/lib/permissions.ts` (and `PERMISSION_CATALOG` if it belongs in the role editor) and wrap the route in `<RouteGuard perms={[…]}>`.
- Playwright: `seedAuthedSession` here also pre-seeds `tl.admin.permissions` so `RouteGuard` passes on first paint.
