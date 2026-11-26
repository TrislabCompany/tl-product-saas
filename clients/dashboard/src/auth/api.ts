import { ApiRequestError, apiFetch } from "@/lib/api-client";

/** A tenant the signed-in account is a member of (`GET /identity/profile/tenants`, and a sign-in that needs a choice). */
export type TenantMembership = {
  id: string;
  name?: string | null;
  isDefault: boolean;
};

/**
 * What `POST /token/issue`, `/token/select` and `/token/switch` answer. Users are global: either the tokens of the
 * tenant the server opened (`tenant`), or, for an account in several tenants with no default, the list to choose
 * from and a short-lived `selectionToken` to send with the choice.
 */
export type SignInResponse = {
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  tenant?: string | null;
  tenantSelectionRequired: boolean;
  selectionToken?: string | null;
  tenants?: TenantMembership[] | null;
};

// X-Trislab-App tells the API this credential request comes from the tenant dashboard. The server uses it to keep
// operator (root) accounts out: a root account signing in with X-Trislab-App=dashboard gets 403, not a token.
const APP_HEADER = { "X-Trislab-App": "dashboard" } as const;

export function issueToken(input: {
  email: string;
  password: string;
  /** Optional: the tenant to open when the account is a member there (a demo account's tenant). */
  tenant?: string;
  /** Authenticator (TOTP) code — sent only on the second step of a 2FA sign-in. */
  twoFactorCode?: string;
}) {
  return apiFetch<SignInResponse>("/api/v1/identity/token/issue", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      ...(input.twoFactorCode ? { twoFactorCode: input.twoFactorCode } : {}),
    }),
    headers: { ...APP_HEADER, ...(input.tenant ? { tenant: input.tenant } : {}) },
    skipAuth: true,
  });
}

/** Finishes a sign-in that needed a tenant choice. */
export function selectTenant(input: { selectionToken: string; tenant: string; setDefault: boolean }) {
  return apiFetch<SignInResponse>("/api/v1/identity/token/select", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { ...APP_HEADER },
    skipAuth: true,
  });
}

/** Moves the signed-in session to another tenant of the same account. */
export function switchTenant(input: { tenant: string; setDefault: boolean }) {
  return apiFetch<SignInResponse>("/api/v1/identity/token/switch", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { ...APP_HEADER },
  });
}

/** The tenants the signed-in account belongs to. */
export function getMyTenants() {
  return apiFetch<TenantMembership[]>("/api/v1/identity/profile/tenants");
}

// Stable ProblemDetails `code`s the token endpoint sets for the second factor
// (the MessageKey IdentityService throws with). The detail text is localized
// under the request culture, so branch on the code, never on the prose.
const TWO_FACTOR_REQUIRED = "Identity.TwoFactorRequired";
const TWO_FACTOR_INVALID = "Identity.TwoFactorInvalid";

function problemCode(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError) || error.status !== 401) return undefined;
  const code = error.problem?.code;
  return typeof code === "string" ? code : undefined;
}

/** The password was right, but the account has 2FA on and no code was sent. */
export function isTwoFactorRequiredError(error: unknown): boolean {
  return problemCode(error) === TWO_FACTOR_REQUIRED;
}

/** The authenticator code was wrong or expired. */
export function isTwoFactorInvalidError(error: unknown): boolean {
  return problemCode(error) === TWO_FACTOR_INVALID;
}
