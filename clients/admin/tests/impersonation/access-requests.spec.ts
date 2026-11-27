import { expect, test, type Page } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installAdminShellMocks, ADMIN_PERMS, paged } from "../helpers/shell-mocks";
import { mockJsonResponse } from "../helpers/api-mocks";

// Impersonation only reads and needs the user's approval (D-44): the operator requests access with a reason,
// the user answers in the dashboard, and only an approved request starts, once, from the tenant's page.

const TENANT_ID = "acme";

const TENANT = {
  id: TENANT_ID,
  name: "Acme Corp",
  adminEmail: "admin@acme.com",
  isActive: true,
  validUpto: "2027-01-01T00:00:00Z",
  issuer: "tl.demo.acme",
};

const ALICE = {
  id: "u-alice",
  userName: "alice",
  email: "alice@acme.com",
  firstName: "Alice",
  lastName: "Smith",
  isActive: true,
  emailConfirmed: true,
};

const request = (over: Record<string, unknown>) => ({
  id: "req-1",
  actorUserId: TEST_USER.sub,
  actorUserName: "rootadmin",
  actorTenantId: "root",
  targetUserId: ALICE.id,
  targetUserName: "alice@acme.com",
  targetTenantId: TENANT_ID,
  reason: "Customer ticket 4821",
  requestedAtUtc: "2026-05-23T10:00:00Z",
  expiresAtUtc: "2026-05-24T10:00:00Z",
  answeredAtUtc: null,
  grantId: null,
  status: "Pending",
  ...over,
});

async function openTenantPage(page: Page, perms: readonly string[] = ADMIN_PERMS, sent: unknown[] = []) {
  await seedAuthedSession(page, { ...TEST_USER, permissions: [...perms] });
  await installAdminShellMocks(page, perms);
  await mockJsonResponse(page, "**/api/v1/tenants/theme", { lightPalette: {}, darkPalette: {}, brandAssets: {}, isDefault: true });
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/grants**", []);
  await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged([ALICE]));
  await mockJsonResponse(page, "**/api/v1/identity/users/*/roles**", []);
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/status`, TENANT);
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/provisioning`, null);
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests?**", sent, { method: "GET" });
  await page.goto(`/tenants/${TENANT_ID}`);
  await expect(page.getByRole("heading", { name: "Acme Corp" }).first()).toBeVisible({ timeout: 10_000 });
}

test("the dialog asks the user for access with a reason; it starts nothing", async ({ page }) => {
  await openTenantPage(page);
  const posted: Record<string, unknown>[] = [];
  let started = false;
  await page.route("**/api/v1/identity/impersonation/requests", async (route) => {
    posted.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(request({})) });
  });
  await page.route("**/api/v1/identity/impersonation/start", async (route) => {
    started = true;
    await route.abort();
  });

  await page.getByRole("button", { name: "Request access" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Alice Smith/ }).click();
  await dialog.getByLabel("Reason").fill("Customer ticket 4821");
  await dialog.getByRole("button", { name: "Request read-only access" }).click();

  await expect(page.getByText("Access requested", { exact: true })).toBeVisible();
  expect(posted).toEqual([{ targetUserId: ALICE.id, targetTenantId: TENANT_ID, reason: "Customer ticket 4821" }]);
  expect(started).toBe(false);
  // The dialog no longer offers a session length: that is chosen when an approved request starts.
  await expect(dialog).toBeHidden();
});

test("a pending request waits; only an approved one offers Start, with the chosen length", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url ?? ""));
      return null;
    };
  });
  const starts: Record<string, unknown>[] = [];
  await page.route("**/api/v1/identity/impersonation/start", async (route) => {
    starts.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: "header.payload.sig", accessTokenExpiresAt: "2026-05-23T11:00:00Z" }),
    });
  });
  await openTenantPage(page, ADMIN_PERMS, [
    request({ id: "req-approved", status: "Approved", targetUserName: "alice@acme.com" }),
    request({ id: "req-pending", status: "Pending", targetUserName: "bob@acme.com" }),
    request({ id: "req-other", status: "Approved", targetTenantId: "globex", targetUserName: "carol@globex.com" }),
  ]);

  const card = page.locator("section").filter({ hasText: "Access requests" });
  await expect(card.getByText("Waiting for answer")).toBeVisible();
  await expect(card.getByText("Approved", { exact: true })).toBeVisible();
  // Another tenant's request isn't on this tenant's page.
  await expect(card.getByText("carol@globex.com")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Start read-only" })).toHaveCount(1);

  await card.getByRole("button", { name: "30 min" }).click();
  await card.getByRole("button", { name: "Start read-only" }).click();

  await expect.poll(() => starts.length).toBe(1);
  expect(starts[0]).toEqual({ requestId: "req-approved", durationMinutes: 30 });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.length))
    .toBe(1);
});

test("a refused start shows the server's reason", async ({ page }) => {
  await page.route("**/api/v1/identity/impersonation/start", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Forbidden", status: 403, detail: "The user hasn't approved this request." }),
    }),
  );
  await openTenantPage(page, ADMIN_PERMS, [request({ status: "Approved" })]);

  await page.getByRole("button", { name: "Start read-only" }).click();
  await expect(page.getByText("The user hasn't approved this request.")).toBeVisible();
});

test("without Users.Impersonate there is no request button and no requests card", async ({ page }) => {
  const perms = ADMIN_PERMS.filter((p) => p !== "Permissions.Users.Impersonate");
  const asked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/impersonation/requests")) asked.push(r.url());
  });
  await openTenantPage(page, perms, [request({ status: "Approved" })]);

  await expect(page.getByRole("button", { name: "Request access" })).toHaveCount(0);
  await expect(page.getByText("Access requests")).toHaveCount(0);
  expect(asked).toEqual([]);
});
