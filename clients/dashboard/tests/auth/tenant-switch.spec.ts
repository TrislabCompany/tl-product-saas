import { expect, test } from "@playwright/test";
import { mockJsonResponse } from "../helpers/api-mocks";
import { fakeJwt, seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks } from "../helpers/shell-mocks";

// Users are global: an account in several tenants switches between them from the profile menu
// (POST /token/switch), which re-issues the session for the other tenant.

const TENANTS = [
  { id: "acme", name: "Acme Corp", isDefault: true },
  { id: "globex", name: "Globex", isDefault: false },
];

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
});

test("an account in one tenant sees no organisation section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /open profile menu/i }).click();
  await expect(page.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
  await expect(page.getByText("Organisation", { exact: true })).toHaveCount(0);
});

test("lists the account's tenants with the current one checked, and switches", async ({ page }) => {
  await mockJsonResponse(page, "**/api/v1/identity/profile/tenants", TENANTS);
  await mockJsonResponse(page, "**/api/v1/identity/token/switch", {
    accessToken: fakeJwt({ sub: TEST_USER.sub, tenant: "globex", exp: Math.floor(Date.now() / 1000) + 3600 }),
    refreshToken: "refresh-2",
    tenant: "globex",
    tenantSelectionRequired: false,
  });

  await page.goto("/");
  await page.getByRole("button", { name: /open profile menu/i }).click();

  await expect(page.getByText("Organisation", { exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Acme Corp" })).toBeVisible();

  const switched = page.waitForRequest((r) => r.url().includes("/api/v1/identity/token/switch") && r.method() === "POST");
  await page.getByRole("menuitem", { name: "Globex" }).click();
  expect((await switched).postDataJSON()).toEqual({ tenant: "globex", setDefault: false });

  await expect.poll(() => page.evaluate(() => localStorage.getItem("tl.dashboard.tenant"))).toBe("globex");
});
