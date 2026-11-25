import { ApiRequestError, apiFetch } from "@/lib/api-client";

/**
 * What `POST /token/issue` answers. Users are global: the tokens of the tenant the server opened (an operator
 * always opens root), or, for an account in several tenants with no default, a tenant choice. The admin app is
 * the operator console, so a choice means a tenant account, which it turns away.
 */
export type SignInResponse = {
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  tenant?: string | null;
  tenantSelectionRequired: boolean;
};

export function issueToken(input: {
  email: string;
  password: string;
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
    // X-Trislab-App marks this client as the platform-admin app. Used by the
    // API to enforce the SuperAdmin / dashboard boundary. No tenant header: an
    // operator always signs in to root.
    headers: { "X-Trislab-App": "admin" },
    skipAuth: true,
  });
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
/** Thrown when an account of another tenant than root signs in: the admin app is the operator console. */
export class OperatorOnlyError extends Error {
  constructor() {
    super("The admin app is for the operator only.");
    this.name = "OperatorOnlyError";
  }
}

export function isTwoFactorRequiredError(error: unknown): boolean {
  return problemCode(error) === TWO_FACTOR_REQUIRED;
}

/** The authenticator code was wrong or expired. */
export function isTwoFactorInvalidError(error: unknown): boolean {
  return problemCode(error) === TWO_FACTOR_INVALID;
}
