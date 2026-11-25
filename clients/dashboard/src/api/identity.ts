import { apiFetch } from "@/lib/api-client";
import type { PagedResponse } from "@/api/paged";

// -----------------------------
// Types
// -----------------------------

export type UserDto = {
  id?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive: boolean;
  emailConfirmed: boolean;
  phoneNumber?: string;
  imageUrl?: string;
  twoFactorEnabled?: boolean;
  locale?: string | null;
};

export type UserRoleDto = {
  roleId?: string;
  roleName?: string;
  description?: string;
  enabled: boolean;
};

export type RoleDto = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: string[] | null;
};

export type SearchUsersParams = {
  pageNumber?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  isActive?: boolean | null;
  emailConfirmed?: boolean | null;
  roleId?: string | null;
};

/** An invitation into the caller's tenant (`POST/GET /identity/invitations`). */
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

/** What a user picker shows (`GET /identity/users/lookup`): no e-mail, phone or status. */
export type UserLookupDto = {
  id: string;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

export type UpsertRoleInput = {
  id: string;
  name: string;
  description?: string;
};

// -----------------------------
// Users
// -----------------------------

export async function searchUsers(params: SearchUsersParams = {}): Promise<PagedResponse<UserDto>> {
  const query = new URLSearchParams();
  query.set("PageNumber", String(params.pageNumber ?? 1));
  query.set("PageSize", String(params.pageSize ?? 20));
  if (params.sort) query.set("Sort", params.sort);
  if (params.search) query.set("Search", params.search);
  if (params.isActive !== null && params.isActive !== undefined) {
    query.set("IsActive", String(params.isActive));
  }
  if (params.emailConfirmed !== null && params.emailConfirmed !== undefined) {
    query.set("EmailConfirmed", String(params.emailConfirmed));
  }
  if (params.roleId) query.set("RoleId", params.roleId);
  return apiFetch<PagedResponse<UserDto>>(`/api/v1/identity/users/search?${query.toString()}`);
}

export async function getUserById(id: string): Promise<UserDto> {
  return apiFetch<UserDto>(`/api/v1/identity/users/${encodeURIComponent(id)}`);
}

export async function getUserRoles(id: string): Promise<UserRoleDto[]> {
  return apiFetch<UserRoleDto[]>(`/api/v1/identity/users/${encodeURIComponent(id)}/roles`);
}

export async function assignUserRoles(userId: string, userRoles: UserRoleDto[]): Promise<string> {
  return apiFetch<string>(`/api/v1/identity/users/${encodeURIComponent(userId)}/roles`, {
    method: "POST",
    body: JSON.stringify({ userId, userRoles }),
  });
}

export async function toggleUserStatus(userId: string, activate: boolean): Promise<void> {
  await apiFetch<void>(`/api/v1/identity/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ userId, activateUser: activate }),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/identity/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function resendUserConfirmationEmail(userId: string): Promise<void> {
  await apiFetch<void>(
    `/api/v1/identity/users/${encodeURIComponent(userId)}/resend-confirmation-email`,
    { method: "POST" },
  );
}

/**
 * Persist a durable avatar URL on the authenticated user. Typically the publicUrl returned
 * by the Files module after a presigned upload; pass null/empty to clear.
 */
export async function setProfileImage(imageUrl: string | null): Promise<void> {
  await apiFetch<void>(`/api/v1/identity/profile/image`, {
    method: "PUT",
    body: JSON.stringify({ imageUrl }),
  });
}

/** Fetch the authenticated user's full profile (name, email, phone, imageUrl, etc.). */
/**
 * The signed-in user's effective permissions. The JWT carries only role names;
 * permissions are resolved server-side per role here. The auth context calls
 * this after login and on subject changes so gated UI reflects the live grants.
 */
export async function getMyPermissions(): Promise<string[]> {
  return (await apiFetch<string[] | null>(`/api/v1/identity/permissions`)) ?? [];
}

// Users are global: an administrator invites an address, and its owner accepts the e-mailed link.
export async function inviteUser(input: InviteUserInput): Promise<void> {
  await apiFetch<InvitationDto>(`/api/v1/identity/invitations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listInvitations(): Promise<InvitationDto[]> {
  return (await apiFetch<InvitationDto[] | null>(`/api/v1/identity/invitations`)) ?? [];
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/identity/invitations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** The tenant an accepted invitation opened. */
export type AcceptInvitationResponse = { tenant: string; tenantName?: string | null };

/**
 * Accepts an invitation. A new or unconfirmed account sends the password it sets (which also confirms the
 * e-mail); a confirmed account must be signed in, and is answered 401 `Identity.InvitationSignInRequired` otherwise.
 */
export async function acceptInvitation(input: {
  token: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  /** False for a confirmed account accepting while signed in. */
  anonymous: boolean;
}): Promise<AcceptInvitationResponse> {
  const { anonymous, ...body } = input;
  return apiFetch<AcceptInvitationResponse>(`/api/v1/identity/invitations/accept`, {
    method: "POST",
    skipAuth: anonymous,
    body: JSON.stringify(body),
  });
}

/** The shortest search `GET /users/lookup` takes. */
export const MIN_USER_SEARCH = 2;

function fromLookup(u: UserLookupDto): UserDto {
  return {
    id: u.id,
    userName: u.userName ?? undefined,
    firstName: u.firstName ?? undefined,
    lastName: u.lastName ?? undefined,
    imageUrl: u.imageUrl ?? undefined,
    // The lookup returns active users only, and never their e-mail.
    isActive: true,
    emailConfirmed: true,
  };
}

/**
 * The users a picker offers for a search, in the shape the pickers render. Every user may pick (Users.Pick), so
 * this goes through the lookup, never the Admin-only user list. A search shorter than MIN_USER_SEARCH finds nobody.
 */
export async function pickUsers(search: string, limit = 8): Promise<{ items: UserDto[] }> {
  const term = search.trim();
  if (term.length < MIN_USER_SEARCH) return { items: [] };
  return { items: (await lookupUsers({ search: term, limit })).map(fromLookup) };
}

/** One user's name and picture by id, for showing who wrote or owns something. Null when not an active member. */
export async function lookupUser(id: string): Promise<UserDto | null> {
  const [found] = await lookupUsers({ ids: [id] });
  return found ? fromLookup(found) : null;
}

/** Users for a picker by name (at least 2 characters), or the names of users by id. Needs only Users.Pick. */
export async function lookupUsers(params: { search?: string; ids?: string[]; limit?: number }): Promise<UserLookupDto[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  for (const id of params.ids ?? []) query.append("ids", id);
  if (params.limit) query.set("limit", String(params.limit));
  return (await apiFetch<UserLookupDto[] | null>(`/api/v1/identity/users/lookup?${query.toString()}`)) ?? [];
}

// -----------------------------
// Roles
// -----------------------------

export async function listRoles(): Promise<RoleDto[]> {
  const result = await apiFetch<RoleDto[] | { items?: RoleDto[] }>(`/api/v1/identity/roles`);
  if (Array.isArray(result)) return result;
  return result.items ?? [];
}

export async function getRoleWithPermissions(id: string): Promise<RoleDto> {
  return apiFetch<RoleDto>(`/api/v1/identity/${encodeURIComponent(id)}/permissions`);
}

export async function upsertRole(input: UpsertRoleInput): Promise<RoleDto> {
  return apiFetch<RoleDto>(`/api/v1/identity/roles`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<string> {
  return apiFetch<string>(`/api/v1/identity/${encodeURIComponent(roleId)}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ roleId, permissions }),
  });
}

export async function deleteRole(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/identity/roles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// One row in the host's permission catalog. Mirrors
// Trislab.Modules.Identity.Contracts.DTOs.PermissionCatalogEntryDto. The catalog
// endpoint is the single source of truth — every module's permissions land
// here at startup, filtered to the caller's tenant context (Admin set for
// regular tenants; Admin + Root set for the root tenant).
export type PermissionCatalogEntryDto = {
  name: string;
  description: string;
  resource: string;
  action: string;
  isBasic: boolean;
  isRoot: boolean;
};

export async function getPermissionsCatalog(): Promise<PermissionCatalogEntryDto[]> {
  return apiFetch<PermissionCatalogEntryDto[]>(`/api/v1/identity/permissions/catalog`);
}

// -----------------------------
// User sessions (admin)
// -----------------------------

export type AdminUserSessionDto = {
  id: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isActive: boolean;
  isCurrentSession: boolean;
};

export async function getUserSessionsAdmin(userId: string): Promise<AdminUserSessionDto[]> {
  return apiFetch<AdminUserSessionDto[]>(
    `/api/v1/identity/users/${encodeURIComponent(userId)}/sessions`,
  );
}

export async function adminRevokeUserSession(userId: string, sessionId: string): Promise<void> {
  await apiFetch<void>(
    `/api/v1/identity/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

export async function adminRevokeAllUserSessions(
  userId: string,
): Promise<{ revokedCount: number }> {
  return apiFetch<{ revokedCount: number }>(
    `/api/v1/identity/users/${encodeURIComponent(userId)}/sessions/revoke-all`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

// -----------------------------
// Groups
// -----------------------------

export type GroupDto = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isSystemGroup: boolean;
  memberCount: number;
  roleIds?: string[] | null;
  roleNames?: string[] | null;
  createdAt: string;
};

export type GroupMemberDto = {
  userId: string;
  userName?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  addedAt: string;
  addedBy?: string | null;
};

export type CreateGroupInput = {
  name: string;
  description?: string;
  isDefault: boolean;
  roleIds?: string[];
};

export type UpdateGroupInput = {
  name: string;
  description?: string;
  isDefault: boolean;
  roleIds?: string[];
};

export async function listGroups(search?: string): Promise<GroupDto[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const result = await apiFetch<GroupDto[] | { items?: GroupDto[] }>(
    `/api/v1/identity/groups${q}`,
  );
  if (Array.isArray(result)) return result;
  return result.items ?? [];
}

export async function getGroupById(id: string): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/api/v1/identity/groups/${encodeURIComponent(id)}`);
}

export async function createGroup(input: CreateGroupInput): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/api/v1/identity/groups`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateGroup(id: string, input: UpdateGroupInput): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/api/v1/identity/groups/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteGroup(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/identity/groups/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberDto[]> {
  return apiFetch<GroupMemberDto[]>(
    `/api/v1/identity/groups/${encodeURIComponent(groupId)}/members`,
  );
}

export async function addUsersToGroup(
  groupId: string,
  userIds: string[],
): Promise<{ addedCount: number; alreadyMemberUserIds: string[] }> {
  return apiFetch<{ addedCount: number; alreadyMemberUserIds: string[] }>(
    `/api/v1/identity/groups/${encodeURIComponent(groupId)}/members`,
    { method: "POST", body: JSON.stringify({ userIds }) },
  );
}

export async function removeUserFromGroup(groupId: string, userId: string): Promise<void> {
  await apiFetch<void>(
    `/api/v1/identity/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

// -----------------------------
// Impersonation
// -----------------------------

export type ImpersonationResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  actorUserId: string;
  actorTenantId: string;
  impersonatedUserId: string;
  impersonatedTenantId: string;
};

export type EndImpersonationResponse = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  accessTokenExpiresAt: string;
};

export async function startImpersonation(input: {
  targetUserId: string;
  targetTenantId: string;
  reason?: string;
}): Promise<ImpersonationResponse> {
  return apiFetch<ImpersonationResponse>(`/api/v1/identity/impersonation/start`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function endImpersonation(): Promise<EndImpersonationResponse> {
  return apiFetch<EndImpersonationResponse>(`/api/v1/identity/impersonation/end`, {
    method: "POST",
  });
}

// -----------------------------
// Profile update (PUT /identity/profile)
// -----------------------------

export type UpdateProfileInput = {
  /**
   * The profile the form was seeded from, and the ETag that read carried. Both come from the
   * caller rather than from a read inside the save: the lost update this guards against happens
   * between the moment the user saw the values and the moment they press save, so a tag fetched
   * inside the save has no chance of being stale and no chance of catching anything.
   */
  profile: UserDto;
  expectedETag: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  /** BCP 47 UI language tag persisted on the user (drives the JWT locale claim). */
  locale: string | null;
};

/**
 * Reads the profile along with the ETag the server publishes for it. The tag is the
 * profile's version marker: echoing it back in `If-Match` on the PUT below is what lets
 * the server reject a save built from a snapshot someone else has since changed.
 *
 * Use this as the read that populates an edit form, and hand the tag it returns back to
 * {@link updateMyProfile}. A tag read at save time cannot detect anything.
 */
export async function getMyProfileWithETag(): Promise<{ profile: UserDto; etag: string | null }> {
  let etag: string | null = null;
  const profile = await apiFetch<UserDto>("/api/v1/identity/profile", {
    onResponse: (response) => {
      // Strip a `W/` prefix rather than pass it through. The endpoint only ever emits a strong
      // validator, so a weak one is an artefact of the transport: a compressing edge (Cloudflare
      // does this by default once it re-encodes a response) downgrades the tag it forwards. Sending
      // it back as-is means the server drops it under the strong comparison `If-Match` mandates and
      // answers 412 forever, which is a profile the user can never save.
      const header = response.headers.get("ETag");
      etag = header ? header.replace(/^W\//, "") : null;
    },
  });
  return { profile, etag };
}

/**
 * Updates the authenticated user's profile. Maps to UpdateUserCommand server-side. The image
 * goes through its own endpoint, and the e-mail address can't be changed here (it needs a
 * confirmation flow) — this is for the editable profile fields surfaced in settings/profile. The unedited fields come off `input.profile`, the copy
 * the form was seeded from, so they keep their values instead of being nulled.
 *
 * The PUT carries `If-Match` with that same copy's ETag, so the server answers 412 when the
 * profile moved after the user last saw it, instead of accepting a full representation built
 * from a stale snapshot and blanking the concurrent change. A 412 is NOT retried here: the only
 * body this function has is the one the user typed against the old values, and resending it
 * against a fresh tag performs exactly the overwrite the 412 exists to prevent. The caller
 * decides — normally by telling the user the profile changed and asking for a deliberate re-save.
 */
export async function updateMyProfile(input: UpdateProfileInput): Promise<void> {
  const { profile, expectedETag } = input;
  await apiFetch<unknown>(`/api/v1/identity/profile`, {
    method: "PUT",
    headers: expectedETag ? { "If-Match": expectedETag } : undefined,
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

// -----------------------------
// Password reset trio (anonymous; require explicit tenant header)
// -----------------------------

/**
 * Step 1 of the forgot-password flow. The server resolves the user by
 * (email, tenant), generates a reset token, and emails a link of the form
 * `<host>/reset-password?token=...&email=...&tenant=...`. Server always
 * returns 200 regardless of whether the email exists — never leak account
 * presence to the caller.
 */
export async function requestPasswordReset(input: { email: string }): Promise<void> {
  await apiFetch<string>(`/api/v1/identity/forgot-password`, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: input.email }),
  });
}

/**
 * Step 2 of the forgot-password flow. The caller carries (token, email,
 * tenant) from the emailed link plus a new password from the form. The
 * server validates the token via UserManager.ResetPasswordAsync and
 * persists the new hash. Existing JWTs remain valid until natural expiry —
 * the UI should bounce the user to /login to acquire a fresh session.
 */
export async function resetPassword(input: {
  email: string;
  password: string;
  token: string;
  /** Only when the link names one: users are global. */
  tenant?: string;
}): Promise<void> {
  await apiFetch<string>(`/api/v1/identity/reset-password`, {
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
 * here, which proves the address. The tenant goes in the header the endpoint reads. Returns the server's
 * confirmation message on 2xx.
 */
export async function confirmEmail(input: {
  userId: string;
  code: string;
  tenant: string;
  password: string;
}): Promise<string> {
  return apiFetch<string>(`/api/v1/identity/confirm-email`, {
    method: "POST",
    skipAuth: true,
    headers: { tenant: input.tenant },
    body: JSON.stringify({ userId: input.userId, code: input.code, password: input.password }),
  });
}

// -----------------------------
// Password change (authenticated)
// -----------------------------

export async function changePassword(input: {
  password: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  await apiFetch<string>(`/api/v1/identity/change-password`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// -----------------------------
// Two-factor enrollment (TOTP)
// -----------------------------

export type TwoFactorEnrollmentResponse = {
  sharedKey: string;
  authenticatorUri: string;
};

/**
 * Begin (or rotate) TOTP enrollment. 2FA is NOT enabled until the user
 * confirms with a code via verifyEnrollTwoFactor — this just hands back
 * the secret + otpauth:// URI so the QR can render.
 */
export async function enrollTwoFactor(): Promise<TwoFactorEnrollmentResponse> {
  return apiFetch<TwoFactorEnrollmentResponse>(`/api/v1/identity/2fa/enroll`, {
    method: "POST",
  });
}

export async function verifyEnrollTwoFactor(code: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/identity/2fa/verify`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disableTwoFactor(currentPassword: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/identity/2fa/disable`, {
    method: "POST",
    body: JSON.stringify({ currentPassword }),
  });
}
