import { expect, test, type Page } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installAdminShellMocks, ADMIN_PERMS } from "../helpers/shell-mocks";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";

// "Restore admin access" is the one write the operator makes inside a tenant (D-44): an address becomes the
// tenant's Admin again; the tenant's active Admins are e-mailed and the audit trail records it.

const TENANT_ID = "acme";
const RESTORE_URL = `**/api/v1/identity/tenants/${TENANT_ID}/restore-admin`;

const TENANT = {
  id: TENANT_ID,
  name: "Acme Corp",
  adminEmail: "admin@acme.com",
  isActive: true,
  validUpto: "2027-01-01T00:00:00Z",
  issuer: "tl.demo.acme",
};

async function openTenantPage(page: Page, perms: readonly string[] = ADMIN_PERMS) {
  await seedAuthedSession(page, { ...TEST_USER, permissions: [...perms] });
  await installAdminShellMocks(page, perms);
  await mockJsonResponse(page, "**/api/v1/tenants/theme", { lightPalette: {}, darkPalette: {}, brandAssets: {}, isDefault: true });
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/grants**", []);
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests?**", []);
  await mockJsonResponse(page, "**/api/v1/identity/users/search**", { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false });
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/status`, TENANT);
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/provisioning`, null);
  await page.goto(`/tenants/${TENANT_ID}`);
  await expect(page.getByRole("heading", { name: "Acme Corp" }).first()).toBeVisible({ timeout: 10_000 });
}

async function fillAndSubmit(page: Page, email: string, reason: string) {
  await page.getByRole("button", { name: "Restore admin access" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/E-mail address/).fill(email);
  await dialog.getByLabel(/Reason/).fill(reason);
  await dialog.getByRole("button", { name: "Restore admin access" }).click();
  return dialog;
}

test("posts the address and reason, and says who was told", async ({ page }) => {
  await openTenantPage(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route(RESTORE_URL, async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ outcome: "Invited", adminsNotified: 2 }),
    });
  });

  const dialog = await fillAndSubmit(page, "new-admin@acme.com", "Customer lost access, ticket 4821");

  await expect(page.getByText("Admin invitation sent")).toBeVisible();
  await expect(page.getByText("new-admin@acme.com · existing Admins told: 2")).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(bodies).toEqual([
    { email: "new-admin@acme.com", reason: "Customer lost access, ticket 4821", firstName: null, lastName: null },
  ]);
});

test("an active member is made Admin at once", async ({ page }) => {
  await openTenantPage(page);
  await mockJsonResponse(page, RESTORE_URL, { outcome: "RoleAssigned", adminsNotified: 0 });

  await fillAndSubmit(page, "member@acme.com", "Only Admin left the company");

  await expect(page.getByText("Admin role assigned")).toBeVisible();
});

test("a wrong address or a short reason never reaches the server", async ({ page }) => {
  await openTenantPage(page);
  let called = false;
  await page.route(RESTORE_URL, async (route) => {
    called = true;
    await route.abort();
  });

  const dialog = await fillAndSubmit(page, "not-an-address", "x");

  await expect(dialog.getByText("Enter a valid e-mail address")).toBeVisible();
  await expect(dialog.getByText("Give a reason of at least 4 characters")).toBeVisible();
  expect(called).toBe(false);
});

test("the server's refusal is shown", async ({ page }) => {
  await openTenantPage(page);
  await mockProblemDetails(page, RESTORE_URL, 404, { title: "Not Found", detail: "Tenant 'acme' wasn't found." });

  await fillAndSubmit(page, "new-admin@acme.com", "Customer lost access");

  await expect(page.getByText("Could not restore admin access")).toBeVisible();
  await expect(page.getByText("Tenant 'acme' wasn't found.")).toBeVisible();
});

test("without Users.RestoreAdmin there is no button", async ({ page }) => {
  await openTenantPage(page, ADMIN_PERMS.filter((p) => p !== "Permissions.Users.RestoreAdmin"));

  await expect(page.getByRole("button", { name: "Restore admin access" })).toHaveCount(0);
});
