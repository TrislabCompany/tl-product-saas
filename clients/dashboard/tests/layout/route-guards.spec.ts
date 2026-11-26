import { expect, test } from "@playwright/test";
import { mockJsonResponse } from "../helpers/api-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks, paged, SHELL_PERMISSIONS } from "../helpers/shell-mocks";

// Every page behind a permission is guarded as in the admin console: a typed address opens a page
// exactly when its menu item shows (routes.tsx, nav-data.ts). A Basic user gets the 403 view on the
// Admin pages, and the page's own data is never requested.

const ADMIN_PAGES = [
  "/identity/users",
  "/identity/users/u-2",
  "/identity/roles",
  "/identity/groups",
  "/system/health",
  "/system/audits",
  "/system/sessions",
  "/system/trash",
  "/settings/branding",
] as const;

test.describe("route guards", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
  });

  for (const path of ADMIN_PAGES) {
    test(`a Basic user can't open ${path}`, async ({ page }) => {
      const pageData: string[] = [];
      page.on("request", (r) => {
        const p = new URL(r.url()).pathname;
        if (/^\/api\/(v1\/(identity\/(users|roles|groups)|audits|sessions|trash)|health\/details)/.test(p)) pageData.push(p);
      });

      await page.goto(path);

      await expect(page.getByTestId("forbidden")).toBeVisible();
      await expect(page.getByRole("heading", { name: "You can't open this page" })).toBeVisible();
      expect(pageData).toEqual([]);
    });
  }

  test("a Basic user opens the pages of the Basic role", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/billing/subscriptions/me**", null);
    await mockJsonResponse(page, "**/api/v1/billing/usage**", []);
    await page.goto("/settings/profile");
    await expect(page.getByTestId("forbidden")).toHaveCount(0);
    await page.goto("/subscription");
    await expect(page.getByTestId("forbidden")).toHaveCount(0);
  });

  test("an Admin opens the users page", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/permissions", [
      ...SHELL_PERMISSIONS,
      "Permissions.Users.View",
      "Permissions.Users.Update",
    ]);
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged([]));

    await page.goto("/identity/users");

    await expect(page.getByTestId("forbidden")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the 403 view leads back home", async ({ page }) => {
    await page.goto("/system/audits");
    await page.getByRole("link", { name: "Back home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
