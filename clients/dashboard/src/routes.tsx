import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ProtectedRoute } from "@/auth/protected-route";
import { RouteGuard } from "@/auth/route-guard";
import type { RouteGate } from "@/auth/route-gate";
import { BRANDING_GATE, navGate } from "@/components/layout/nav-data";
import { RouteError } from "@/components/route-error";
import { RouteFallback } from "@/components/route-fallback";
import { loadNamespaces, type LazyNamespace } from "@/i18n";

// ─────────────────────────────────────────────────────────────────────────
// Lazy route boundaries
//
// Each route is split into its own bundle so first paint after login only
// loads the chunk for the landing page (Overview). Catalog, Settings,
// Login, Activity, etc. fetch on demand.
//
// `lazyNamed` wraps a dynamic import that exports a *named* component
// (we don't use default exports anywhere in this codebase). Returns a
// shape compatible with React.lazy.
//
// `namespaces` lists the route-only translation catalogs the page (and the
// components it imports) use. They load in parallel with the page chunk, so
// the page never renders before its text is there. The shell's namespaces
// (common, auth, notifications) are always loaded and are not listed.
// ─────────────────────────────────────────────────────────────────────────

function lazyNamed<T extends Record<string, unknown>, K extends keyof T>(
  importer: () => Promise<T>,
  name: K,
  namespaces: readonly LazyNamespace[] = [],
) {
  return lazy(async () => {
    const [mod] = await Promise.all([importer(), loadNamespaces(namespaces)]);
    return { default: mod[name] as ComponentType<unknown> };
  });
}

const LoginPage = lazyNamed(() => import("@/pages/login"), "LoginPage");
const ForgotPasswordPage = lazyNamed(
  () => import("@/pages/auth/forgot-password"),
  "ForgotPasswordPage",
);
const ResetPasswordPage = lazyNamed(
  () => import("@/pages/auth/reset-password"),
  "ResetPasswordPage",
);
const ConfirmEmailPage = lazyNamed(
  () => import("@/pages/auth/confirm-email"),
  "ConfirmEmailPage",
);
const AcceptInvitationPage = lazyNamed(
  () => import("@/pages/auth/accept-invitation"),
  "AcceptInvitationPage",
);
const OverviewPage = lazyNamed(() => import("@/pages/overview"), "OverviewPage", ["overview"]);
const ActivityPage = lazyNamed(() => import("@/pages/activity"), "ActivityPage", ["activity", "audits"]);
const InvoicesPage = lazyNamed(() => import("@/pages/invoices"), "InvoicesPage", ["subscription"]);
const InvoiceDetailPage = lazyNamed(() => import("@/pages/invoice-detail"), "InvoiceDetailPage", ["subscription"]);
const SubscriptionPage = lazyNamed(() => import("@/pages/subscription"), "SubscriptionPage", ["subscription"]);
const WalletPage = lazyNamed(() => import("@/pages/wallet"), "WalletPage", ["subscription"]);
const BrandsPage = lazyNamed(() => import("@/pages/catalog/brands"), "BrandsPage", ["catalog"]); // [module:Catalog]
const CategoriesPage = lazyNamed(() => import("@/pages/catalog/categories"), "CategoriesPage", ["catalog"]); // [module:Catalog]
const ProductsPage = lazyNamed(() => import("@/pages/catalog/products"), "ProductsPage", ["catalog"]); // [module:Catalog]
const ProductDetailPage = lazyNamed(() => import("@/pages/catalog/product-detail"), "ProductDetailPage", ["catalog", "files"]); // [module:Catalog]
const NotFoundPage = lazyNamed(() => import("@/pages/not-found"), "NotFoundPage");
const TenantDeactivatedPage = lazyNamed(
  () => import("@/pages/tenant-deactivated"),
  "TenantDeactivatedPage",
);
const ImpersonationEndedPage = lazyNamed(
  () => import("@/pages/impersonation-ended"),
  "ImpersonationEndedPage",
);
const SettingsLayout = lazyNamed(() => import("@/pages/settings/settings-layout"), "SettingsLayout", ["settings"]);
const ProfileSettings = lazyNamed(() => import("@/pages/settings/profile"), "ProfileSettings", ["settings", "files"]);
const SecuritySettings = lazyNamed(() => import("@/pages/settings/security"), "SecuritySettings", ["settings"]);
const BrandingSettings = lazyNamed(() => import("@/pages/settings/branding"), "BrandingSettings", ["settings"]);
const AppearanceSettings = lazyNamed(() => import("@/pages/settings/appearance"), "AppearanceSettings", ["settings"]);
const NotificationsSettings = lazyNamed(() => import("@/pages/settings/notifications"), "NotificationsSettings", ["settings"]);
const ApiKeysSettings = lazyNamed(() => import("@/pages/settings/api-keys"), "ApiKeysSettings", ["settings"]);
const HealthPage = lazyNamed(() => import("@/pages/health"), "HealthPage", ["health"]);
const AuditsPage = lazyNamed(() => import("@/pages/audits"), "AuditsPage", ["audits"]);
const TicketsPage = lazyNamed(() => import("@/pages/tickets/tickets"), "TicketsPage", ["tickets"]); // [module:Tickets]
const TicketDetailPage = lazyNamed(() => import("@/pages/tickets/ticket-detail"), "TicketDetailPage", ["tickets"]); // [module:Tickets]
const TrashPage = lazyNamed(() => import("@/pages/system/trash"), "TrashPage", ["system"]);
const SessionsPage = lazyNamed(() => import("@/pages/system/sessions"), "SessionsPage", ["system"]);
const UsersPage = lazyNamed(() => import("@/pages/identity/users"), "UsersPage", ["identity"]);
const UserDetailPage = lazyNamed(() => import("@/pages/identity/user-detail"), "UserDetailPage", ["identity"]);
const RolesPage = lazyNamed(() => import("@/pages/identity/roles"), "RolesPage", ["identity"]);
const RoleDetailPage = lazyNamed(() => import("@/pages/identity/role-detail"), "RoleDetailPage", ["identity"]);
const GroupsPage = lazyNamed(() => import("@/pages/identity/groups"), "GroupsPage", ["identity"]);
const GroupDetailPage = lazyNamed(() => import("@/pages/identity/group-detail"), "GroupDetailPage", ["identity"]);
const MyFilesPage = lazyNamed(() => import("@/pages/files/my-files"), "MyFilesPage", ["files"]);
const ChatPage = lazyNamed(() => import("@/pages/chat/chat-page"), "ChatPage", ["chat"]); // [module:Chat]

/**
 * Wrap a lazy route element in Suspense so each route boundary has its
 * own loading state. Returns a fresh Suspense per call — important so
 * that two routes sharing the same fallback don't share the same
 * suspended chunk's resolution timing.
 */
function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

/**
 * A page behind its permission gate: the gate of its menu item (navGate), so a
 * typed address opens a page exactly when the menu shows it, as in the admin
 * console. A Basic user gets the 403 view on an Admin page.
 */
function guarded(gate: RouteGate, node: React.ReactNode) {
  return <RouteGuard {...gate}>{withSuspense(node)}</RouteGuard>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
    errorElement: <RouteError />,
  },
  {
    path: "/forgot-password",
    element: withSuspense(<ForgotPasswordPage />),
    errorElement: <RouteError />,
  },
  {
    path: "/reset-password",
    element: withSuspense(<ResetPasswordPage />),
    errorElement: <RouteError />,
  },
  {
    path: "/confirm-email",
    element: withSuspense(<ConfirmEmailPage />),
    errorElement: <RouteError />,
  },
  {
    // The link an invitation e-mail carries (users are global): set a password, or sign in, and accept.
    path: "/accept-invitation",
    element: withSuspense(<AcceptInvitationPage />),
    errorElement: <RouteError />,
  },
  {
    // Terminal state when the signed-in user's tenant is deactivated mid-session.
    // Top-level (outside ProtectedRoute/AppShell) — the token is still valid but
    // every request 403s, so there is no shell to render. query-client.ts routes
    // here on detecting the deactivated-tenant 403.
    path: "/tenant-deactivated",
    element: withSuspense(<TenantDeactivatedPage />),
    errorElement: <RouteError />,
  },
  {
    // Terminal state when an operator's impersonation grant is revoked (or its
    // short-lived token expires) mid-session. Top-level (outside
    // ProtectedRoute/AppShell) — the token still decodes but every request
    // 401s, so there is no shell to render. query-client.ts routes here on
    // detecting the impersonation-revoked 401.
    path: "/impersonation-ended",
    element: withSuspense(<ImpersonationEndedPage />),
    errorElement: <RouteError />,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: withSuspense(<OverviewPage />) },
          { path: "activity", element: withSuspense(<ActivityPage />) },
          { path: "subscription", element: guarded(navGate("/subscription"), <SubscriptionPage />) },
          { path: "wallet", element: guarded(navGate("/wallet"), <WalletPage />) },
          { path: "invoices", element: guarded(navGate("/invoices"), <InvoicesPage />) },
          { path: "invoices/:id", element: guarded(navGate("/invoices"), <InvoiceDetailPage />) },
          { path: "system/health", element: guarded(navGate("/system/health"), <HealthPage />) },
          { path: "system/audits", element: guarded(navGate("/system/audits"), <AuditsPage />) },
          { path: "system/trash", element: guarded(navGate("/system/trash"), <TrashPage />) },
          { path: "system/sessions", element: guarded(navGate("/system/sessions"), <SessionsPage />) },
          { path: "files", element: guarded(navGate("/files"), <MyFilesPage />) },
          { path: "chat", element: guarded(navGate("/chat"), <ChatPage />) }, // [module:Chat]
          { path: "chat/:channelId", element: guarded(navGate("/chat"), <ChatPage />) }, // [module:Chat]
          { path: "tickets", element: guarded(navGate("/tickets"), <TicketsPage />) }, // [module:Tickets]
          { path: "tickets/:ticketId", element: guarded(navGate("/tickets"), <TicketDetailPage />) }, // [module:Tickets]
          { path: "identity", element: <Navigate to="/identity/users" replace /> },
          { path: "identity/users", element: guarded(navGate("/identity/users"), <UsersPage />) },
          { path: "identity/users/:userId", element: guarded(navGate("/identity/users"), <UserDetailPage />) },
          { path: "identity/roles", element: guarded(navGate("/identity/roles"), <RolesPage />) },
          { path: "identity/roles/:roleId", element: guarded(navGate("/identity/roles"), <RoleDetailPage />) },
          { path: "identity/groups", element: guarded(navGate("/identity/groups"), <GroupsPage />) },
          { path: "identity/groups/:groupId", element: guarded(navGate("/identity/groups"), <GroupDetailPage />) },
          // [module:Catalog:begin]
          { path: "catalog", element: <Navigate to="/catalog/brands" replace /> },
          { path: "catalog/brands", element: guarded(navGate("/catalog/brands"), <BrandsPage />) },
          { path: "catalog/categories", element: guarded(navGate("/catalog/categories"), <CategoriesPage />) },
          { path: "catalog/products", element: guarded(navGate("/catalog/products"), <ProductsPage />) },
          {
            path: "catalog/products/:productId",
            element: guarded(navGate("/catalog/products"), <ProductDetailPage />),
          },
          // [module:Catalog:end]
          {
            path: "settings",
            element: withSuspense(<SettingsLayout />),
            children: [
              { index: true, element: <Navigate to="profile" replace /> },
              { path: "profile", element: withSuspense(<ProfileSettings />) },
              { path: "security", element: withSuspense(<SecuritySettings />) },
              { path: "appearance", element: withSuspense(<AppearanceSettings />) },
              { path: "branding", element: guarded(BRANDING_GATE, <BrandingSettings />) },
              { path: "notifications", element: withSuspense(<NotificationsSettings />) },
              { path: "api-keys", element: withSuspense(<ApiKeysSettings />) },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: withSuspense(<NotFoundPage />) },
]);
