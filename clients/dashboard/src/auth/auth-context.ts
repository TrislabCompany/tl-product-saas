// The auth context object and its types. The provider is in auth-provider.tsx, so that file
// exports only a component and keeps fast refresh.
import { createContext } from "react";
import type { TenantMembership } from "@/auth/api";

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  tenant?: string;
  permissions: string[];
};

export type ImpersonationInfo = {
  /** The original operator's user id, taken from the act_sub claim. */
  actorUserId: string;
  /** The original operator's tenant, taken from the act_tenant claim. */
  actorTenant?: string;
  /** Display name for the original operator if the token carries act_name. */
  actorName?: string;
};

/** What a sign-in ended in: a session, or a tenant to choose first (an account in several tenants, no default). */
export type LoginResult =
  | { status: "signedIn" }
  | { status: "selectTenant"; selectionToken: string; tenants: TenantMembership[] };

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * True while the provider resolves a stored session at boot — the access
   * token was missing/expired but a refresh token was present, so a silent
   * refresh is in flight. Routes render a loader (not the page, not a redirect)
   * while this is true, so a stale token never flashes a doomed dashboard.
   */
  isInitializing: boolean;
  /**
   * True once permissions have been fetched at least once for the current
   * subject (or no user is signed in). Lets gated UI avoid flashing while the
   * permissions request is still in flight.
   */
  permissionsHydrated: boolean;
  /** Truthy iff the current access token carries act_sub (impersonation mode). */
  impersonation: ImpersonationInfo | null;
  login: (input: { email: string; password: string; tenant?: string; twoFactorCode?: string }) => Promise<LoginResult>;
  /** Finishes a sign-in that answered `selectTenant`. */
  chooseTenant: (input: { selectionToken: string; tenant: string; setDefault: boolean }) => Promise<void>;
  /** Moves the session to another tenant of the signed-in account. */
  switchTenant: (input: { tenant: string; setDefault: boolean }) => Promise<void>;
  logout: () => void;
  /** Re-fetch the permission set for the signed-in user (e.g. after a role change). */
  refreshPermissions: () => Promise<void>;
  /** Begin impersonating another user. Resolves once the new token is installed. */
  /** Starts an approved impersonation request of the caller's (read-only, once). */
  beginImpersonation: (input: { requestId: string }) => Promise<void>;
  /**
   * Stop impersonating. Restores the operator's dashboard session for an
   * intra-app impersonation, or signs out (→ /login) when there is no dashboard
   * session to return to — e.g. a root operator who handed off from the admin
   * app, since a SuperAdmin must never hold a tenant-dashboard session.
   * Resolves with `{ signedOut }` so the caller can route accordingly.
   */
  stopImpersonation: () => Promise<{ signedOut: boolean }>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
