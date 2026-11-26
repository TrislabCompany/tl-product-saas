import { expect, test, type Request } from "@playwright/test";
import { mockJsonResponse } from "../helpers/api-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installAdminShellMocks, ADMIN_PERMS } from "../helpers/shell-mocks";

// The tenant page's "Users and roles" card: the tenant's users and the roles each holds there, read only,
// every call scoped to the tenant with the root operator's `tenant` header override.

const TENANT_ID = "acme";

const TENANT = {
  id: TENANT_ID,
  name: "Acme Corp",
  adminEmail: "admin@acme.com",
  isActive: true,
  validUpto: "2027-01-01T00:00:00Z",
  issuer: "tl.demo.acme",
};

const USERS = {
  items: [
    { id: "u-1", userName: "ana", firstName: "Ana", lastName: "Novak", email: "ana@acme.com", isActive: true, emailConfirmed: true },
    { id: "u-2", userName: "bor", firstName: "Bor", lastName: "Kos", email: "bor@acme.com", isActive: false, emailConfirmed: false },
  ],
  pageNumber: 1,
  pageSize: 10,
  totalCount: 2,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};

const ROLES: Record<string, unknown[]> = {
  "u-1": [
    { roleId: "r-admin", roleName: "Admin", enabled: true },
    { roleId: "r-basic", roleName: "Basic", enabled: true },
  ],
  "u-2": [
    { roleId: "r-admin", roleName: "Admin", enabled: false },
    { roleId: "r-basic", roleName: "Basic", enabled: false },
  ],
};

async function openTenantPage(page: import("@playwright/test").Page, perms: readonly string[] = ADMIN_PERMS) {
  await seedAuthedSession(page, { ...TEST_USER, permissions: [...perms] });
  await installAdminShellMocks(page, perms);
  await mockJsonResponse(page, "**/api/v1/tenants/theme", { lightPalette: {}, darkPalette: {}, brandAssets: {}, isDefault: true });
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/grants**", []);
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/status`, TENANT);
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/provisioning`, null);
}

test("lists the tenant's users with the roles each holds there, scoped by the tenant header", async ({ page }) => {
  const scoped: Request[] = [];
  page.on("request", (r) => {
    if (/\/api\/v1\/identity\/users\//.test(new URL(r.url()).pathname)) scoped.push(r);
  });
  await openTenantPage(page);
  await mockJsonResponse(page, "**/api/v1/identity/users/search**", USERS);
  for (const [id, roles] of Object.entries(ROLES)) {
    await mockJsonResponse(page, `**/api/v1/identity/users/${id}/roles`, roles);
  }

  await page.goto(`/tenants/${TENANT_ID}`);

  const card = page.getByTestId("tenant-members");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("Ana Novak")).toBeVisible();
  await expect(page.getByRole("list", { name: "Roles of Ana Novak" }).getByText("Admin")).toBeVisible();
  await expect(page.getByRole("list", { name: "Roles of Ana Novak" }).getByText("Basic")).toBeVisible();
  // Bor holds no role and is inactive, with an unconfirmed e-mail.
  await expect(page.getByRole("list", { name: "Roles of Bor Kos" }).getByText("No role")).toBeVisible();
  await expect(card.getByText("Inactive")).toBeVisible();
  await expect(card.getByText("E-mail not confirmed")).toBeVisible();

  // Every call names the tenant, so the server scopes it there.
  expect(scoped.length).toBeGreaterThanOrEqual(3);
  for (const r of scoped) expect(r.headers()["tenant"]).toBe(TENANT_ID);
});

test("is read only: no control changes a user or a role", async ({ page }) => {
  await openTenantPage(page);
  await mockJsonResponse(page, "**/api/v1/identity/users/search**", USERS);
  for (const [id, roles] of Object.entries(ROLES)) {
    await mockJsonResponse(page, `**/api/v1/identity/users/${id}/roles`, roles);
  }

  await page.goto(`/tenants/${TENANT_ID}`);

  const card = page.getByTestId("tenant-members");
  await expect(card.getByText("Ana Novak")).toBeVisible({ timeout: 10_000 });
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("checkbox")).toHaveCount(0);
});

test("searching sends the term", async ({ page }) => {
  await openTenantPage(page);
  await mockJsonResponse(page, "**/api/v1/identity/users/search**", USERS);
  await mockJsonResponse(page, "**/api/v1/identity/users/*/roles", []);
  await page.goto(`/tenants/${TENANT_ID}`);
  await expect(page.getByTestId("tenant-members")).toBeVisible({ timeout: 10_000 });

  const searched = page.waitForRequest((r) => r.url().includes("/users/search") && new URL(r.url()).searchParams.get("Search") === "ana");
  await page.getByPlaceholder("Search users").fill("ana");
  expect((await searched).headers()["tenant"]).toBe(TENANT_ID);
});

test("without Users.View the card isn't shown and no user is requested", async ({ page }) => {
  const perms = ADMIN_PERMS.filter((p) => p !== "Permissions.Users.View");
  let searched = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/identity/users/search")) searched = true;
  });
  await openTenantPage(page, perms);

  await page.goto(`/tenants/${TENANT_ID}`);

  await expect(page.getByRole("heading", { level: 2, name: "Acme Corp", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Users and roles")).toHaveCount(0);
  expect(searched).toBe(false);
});
