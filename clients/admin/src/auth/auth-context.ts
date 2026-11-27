// The auth context object and its types. The provider is in auth-provider.tsx, so that file
// exports only a component and keeps fast refresh.
import { createContext } from "react";

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  tenant?: string;
  permissions: string[];
};

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * True while the provider resolves a stored session at boot — the access
   * token was missing/expired but a refresh token was present, so a silent
   * refresh is in flight. Routes render a loader (not the page, not a redirect)
   * while this is true, so a stale token never flashes a protected surface.
   */
  isInitializing: boolean;
  /**
   * True once permissions have been fetched at least once for the current
   * user (or no user is signed in). Route guards check this before rendering
   * a 403 — without it, the first paint flashes "access denied" while the
   * permissions request is still in flight.
   */
  permissionsHydrated: boolean;
  login: (input: { email: string; password: string; twoFactorCode?: string }) => Promise<void>;
  logout: () => void;
  /** Re-fetch the permission set for the signed-in user. Call after a role
   *  assignment changes for the current user. */
  refreshPermissions: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
