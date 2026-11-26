import { ApiRequestError, apiFetch } from "@/lib/api-client";
import type { PagedResponse } from "@/lib/api-types";

export type UserDto = {
  id: string;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  isActive: boolean;
  emailConfirmed: boolean;
  phoneNumber?: string | null;
  imageUrl?: string | null;
  twoFactorEnabled?: boolean;
  /** Persisted BCP 47 UI language tag (e.g. "sl-SI"); null when the user never chose. */
  locale?: string | null;
};

export type UserRoleDto = {
  roleId: string;
  roleName: string;
  description?: string | null;
  enabled: boolean;
};

export type SearchUsersParams = {
  pageNumber?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  isActive?: boolean;
  emailConfirmed?: boolean;
  roleId?: string;
  /**
   * When set, sends a `tenant` header overriding the operator's active tenant
   * for this request only. Used by impersonation flows so a root operator can
   * browse another tenant's users without flipping their global session.
   */
  tenantId?: string;
};

/** An invitation into the operator's tenant, root (`POST/GET /identity/invitations`). */
export type InvitationDto = {
  id: string;
  email: string;
  status: string;
  createdOnUtc: string;
  expiresOnUtc: string;
  acceptedOnUtc?: string | null;
  revokedOnUtc?: string | null;
};

export type InviteUserInput = {
  email: string;
  firstName?: string;
  lastName?: string;
};

const BASE = "/api/v1/identity/users";
const IDENTITY = "/api/v1/identity";

/**
 * Returns the permission strings the current user holds. The JWT only carries
 * role names — permissions are resolved server-side per role on this endpoint,
 * so client-side route guards must call it after login (and after a refresh
 * if grants may have changed).
 */
export async function getMyPermissions(): Promise<string[]> {
  return (await apiFetch<string[] | null>(`${IDENTITY}/permissions`)) ?? [];
}

export async function getMyProfile(): Promise<UserDto> {
  return apiFetch<UserDto>(`${IDENTITY}/profile`);
}

export async function setProfileImage(imageUrl: string | null): Promise<void> {
  await apiFetch<void>(`${IDENTITY}/profile/image`, {
    method: "PUT",
    body: JSON.stringify({ imageUrl }),
  });
}

export type UpdateMyProfileInput = {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  /** BCP 47 UI language tag persisted on the user (drives the JWT locale claim). */
  locale?: string | null;
};

/**
 * Self-update of the authenticated user's profile (PUT /identity/profile,
 * server forces the id to the caller). The backend sets FirstName/LastName
 * unconditionally from the command, so a partial update (e.g. the language
 * switcher sending only `locale`) would wipe the others. Reads the current
 * profile from the server first and merges, so any field the caller omits
 * keeps its persisted value.
 *
 * The PUT echoes the read's ETag in `If-Match`, so a profile edit that lands
 * between the read and the write makes the server answer 412 instead of being
 * silently overwritten. On 412 the read-merge-write runs once more against the
 * fresh profile; the caller only sends the fields it means to change.
 */
export async function updateMyProfile(input: UpdateMyProfileInput): Promise<void> {
  try {
    await putMyProfile(input);
  } catch (err) {
    if (!(err instanceof ApiRequestError) || err.status !== 412) throw err;
    await putMyProfile(input);
  }
}

async function putMyProfile(input: UpdateMyProfileInput): Promise<void> {
  let etag: string | null = null;
  const profile = await apiFetch<UserDto>(`${IDENTITY}/profile`, {
    onResponse: (response) => {
      // The endpoint emits a strong validator; a compressing proxy can downgrade it to W/,
      // which the server's strong If-Match comparison would never match.
      const header = response.headers.get("ETag");
      etag = header ? header.replace(/^W\//, "") : null;
    },
  });
  await apiFetch<void>(`${IDENTITY}/profile`, {
    method: "PUT",
    headers: etag ? { "If-Match": etag } : undefined,
    body: JSON.stringify({
      id: profile.id,
      firstName: input.firstName ?? profile.firstName ?? null,
      lastName: input.lastName ?? profile.lastName ?? null,
      phoneNumber: input.phoneNumber ?? profile.phoneNumber ?? null,
      locale: input.locale ?? profile.locale ?? null,
      deleteCurrentImage: false,
    }),
  });
}

export async function changePassword(input: {
  password: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<string> {
  return apiFetch<string>(`${IDENTITY}/change-password`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function searchUsers(params: SearchUsersParams = {}): Promise<PagedResponse<UserDto>> {
  const q = new URLSearchParams();
  q.set("PageNumber", String(params.pageNumber ?? 1));
  q.set("PageSize", String(params.pageSize ?? 10));
  if (params.sort) q.set("Sort", params.sort);
  if (params.search?.trim()) q.set("Search", params.search.trim());
  if (params.isActive !== undefined) q.set("IsActive", String(params.isActive));
  if (params.emailConfirmed !== undefined) q.set("EmailConfirmed", String(params.emailConfirmed));
  if (params.roleId) q.set("RoleId", params.roleId);
  return apiFetch<PagedResponse<UserDto>>(`${BASE}/search?${q.toString()}`, {
    headers: params.tenantId ? { tenant: params.tenantId } : undefined,
  });
}

export async function getUser(id: string): Promise<UserDto> {
  return apiFetch<UserDto>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function getUserRoles(id: string): Promise<UserRoleDto[]> {
  return apiFetch<UserRoleDto[]>(`${BASE}/${encodeURIComponent(id)}/roles`);
}

// Users are global: an operator invites an address into root, and its owner accepts the e-mailed link
// with their own password (or, for an existing account, signs in and accepts).
export async function inviteUser(input: InviteUserInput): Promise<void> {
  await apiFetch<InvitationDto>(`${IDENTITY}/invitations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listInvitations(): Promise<InvitationDto[]> {
  return (await apiFetch<InvitationDto[] | null>(`${IDENTITY}/invitations`)) ?? [];
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiFetch<void>(`${IDENTITY}/invitations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function toggleUserStatus(id: string, activateUser: boolean): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ userId: id, activateUser }),
  });
}

export async function assignUserRoles(id: string, roles: UserRoleDto[]): Promise<string> {
  return apiFetch<string>(`${BASE}/${encodeURIComponent(id)}/roles`, {
    method: "POST",
    body: JSON.stringify({ userId: id, userRoles: roles }),
  });
}

// -----------------------------
// Anonymous password-reset trio
//   forgot-password → reset-password → confirm-email
// -----------------------------

/**
 * Step 1 of the forgot-password flow. Server resolves the user by e-mail
 * (users are global), generates a reset token, and emails them the link.
 * Server always returns 200 regardless of whether the email exists —
 * never leak account presence to the UI.
 */
export async function requestPasswordReset(input: { email: string }): Promise<void> {
  await apiFetch<string>(`${IDENTITY}/forgot-password`, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: input.email }),
  });
}

/**
 * Step 2 — caller carries (token, email, tenant) from the emailed link
 * plus a new password from the form. Existing JWTs stay valid until
 * natural expiry; the UI should bounce to /login after success.
 */
export async function resetPassword(input: {
  email: string;
  password: string;
  token: string;
  /** Only when the link names one: users are global. */
  tenant?: string;
}): Promise<void> {
  await apiFetch<string>(`${IDENTITY}/reset-password`, {
    method: "POST",
    skipAuth: true,
    headers: input.tenant ? { tenant: input.tenant } : {},
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      token: input.token,
    }),
  });
}

/**
 * Confirm-email link landing. The link carries (userId, code, tenant); the owner sets the account's password
 * here, which proves the address. The tenant goes in the header the endpoint reads.
 */
export async function confirmEmail(input: {
  userId: string;
  code: string;
  tenant: string;
  password: string;
}): Promise<string> {
  return apiFetch<string>(`${IDENTITY}/confirm-email`, {
    method: "POST",
    skipAuth: true,
    headers: { tenant: input.tenant },
    body: JSON.stringify({ userId: input.userId, code: input.code, password: input.password }),
  });
}
