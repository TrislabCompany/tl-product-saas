import type { ImpersonationResponse } from "@/api/impersonation";
import { env } from "@/env";
import i18n from "@/i18n";

/**
 * Opens the dashboard in a new tab with the impersonation token in the URL hash. Hash params aren't sent to
 * servers or logged in referrers, so this is safer than a query string. The dashboard's bootstrap reads the
 * hash, installs the token and strips the hash before any render.
 *
 * `expiresAt` lets the dashboard show a countdown. `locale` carries the OPERATOR's language across the origin
 * boundary: the server strips the target's `locale` claim so the operator keeps reading in their own language,
 * but the dashboard usually runs on another origin and can't read this app's `tl.admin.lng`. Without it the
 * API's messages would come back in the dashboard's detected language.
 */
export function handoffToDashboard(response: ImpersonationResponse, tenantId: string) {
  const params = new URLSearchParams();
  params.set("token", response.accessToken);
  params.set("tenant", tenantId);
  params.set("expiresAt", response.accessTokenExpiresAt);
  params.set("locale", i18n.resolvedLanguage ?? "en-US");
  const url = `${env.dashboardUrl}/#impersonate?${params.toString()}`;
  // noopener+noreferrer: the opened tab can't navigate this one, and no referrer is sent.
  window.open(url, "_blank", "noopener,noreferrer");
}
