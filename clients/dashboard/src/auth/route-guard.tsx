import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/use-auth";
import { ForbiddenView } from "@/components/forbidden-view";
import { isGranted, type RouteGate } from "@/auth/route-gate";

type RouteGuardProps = RouteGate & { children: ReactNode };

/**
 * RouteGuard — per-route permission wrapper, as in the admin console.
 * Layered inside ProtectedRoute: ProtectedRoute decides "are you signed
 * in?", this decides "may you open this page?". The gates are the menu's
 * (nav-data.ts), so a typed address never opens a page its menu item hides.
 * The API still refuses the data; this keeps the page itself closed.
 *
 * Permissions are fetched after sign-in. While that is in flight
 * (permissionsHydrated=false) it shows a quiet status instead of 403, so
 * there is no flash of "access denied" on first paint.
 */
export function RouteGuard({ perm, anyPerm, children }: RouteGuardProps) {
  const { user, permissionsHydrated } = useAuth();
  const { t } = useTranslation("common");

  if (!permissionsHydrated) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--color-muted-foreground)]"
        role="status"
        aria-busy="true"
      >
        {t("routeGuard.resolving")}
      </div>
    );
  }

  if (!isGranted({ perm, anyPerm }, user?.permissions ?? [])) {
    return <ForbiddenView />;
  }

  return <>{children}</>;
}
