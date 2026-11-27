import { apiFetch } from "@/lib/api-client";

// Impersonation only reads and needs the user's approval (the framework's D-44 rule):
//   1. the operator requests access to one user, with a reason (`requestImpersonation`);
//   2. the user approves or denies it in the dashboard;
//   3. the operator starts the approved request once (`startImpersonation`), which issues a
//      short-lived, read-only token that the admin hands to the dashboard (lib/impersonation-handoff.ts).
// The user can deny the request at any time, which also ends the impersonation it started.
//
// The admin never holds an impersonation session itself, so ending one from here is revoking its grant
// (`revokeImpersonationGrant` in impersonation-grants.ts).

/** The request's status as the API computes it; a status added after this build is shown raw. */
export type ImpersonationRequestStatus = "Pending" | "Approved" | "Denied" | "Used" | "Expired";

export type ImpersonationRequestDto = {
  id: string;
  actorUserId: string;
  actorUserName?: string | null;
  actorTenantId: string;
  targetUserId: string;
  targetUserName?: string | null;
  targetTenantId: string;
  reason: string;
  requestedAtUtc: string;
  expiresAtUtc: string;
  answeredAtUtc?: string | null;
  grantId?: string | null;
  status: ImpersonationRequestStatus;
};

export type RequestImpersonationInput = {
  targetUserId: string;
  targetTenantId: string;
  reason: string;
};

/** Asks the user for access. A second open request for the same user is a 409. */
export function requestImpersonation(input: RequestImpersonationInput): Promise<ImpersonationRequestDto> {
  return apiFetch<ImpersonationRequestDto>(`/api/v1/identity/impersonation/requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** The caller's own requests, newest first. */
export function listSentImpersonationRequests(
  params: { status?: ImpersonationRequestStatus; take?: number } = {},
): Promise<ImpersonationRequestDto[]> {
  const q = new URLSearchParams();
  if (params.status) q.set("Status", params.status);
  q.set("Take", String(params.take ?? 100));
  return apiFetch<ImpersonationRequestDto[]>(`/api/v1/identity/impersonation/requests?${q.toString()}`);
}

export type ImpersonationResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  actorUserId: string;
  actorTenantId: string;
  impersonatedUserId: string;
  impersonatedTenantId: string;
};

/**
 * Starts an approved request; each request starts once. `durationMinutes` is 1..60, and null lets the
 * server use its default. A request that isn't approved, or was denied meanwhile, is a 403.
 */
export function startImpersonation(input: {
  requestId: string;
  durationMinutes?: number;
}): Promise<ImpersonationResponse> {
  return apiFetch<ImpersonationResponse>(`/api/v1/identity/impersonation/start`, {
    method: "POST",
    body: JSON.stringify({
      requestId: input.requestId,
      durationMinutes: input.durationMinutes ?? null,
    }),
  });
}
