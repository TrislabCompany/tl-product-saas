import { expect, test } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks } from "../helpers/shell-mocks";

// Task 12 (Wave A) — the app shell (topbar + sidebar) reads from the `common`
// namespace. Default locale is en-US, so the existing area specs cover the
// English side; here we switch to Slovenščina and assert the shell chrome
// localizes in place (menu labels + sidebar nav).

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
});

test.describe("app shell localization", () => {
  test("english shell chrome renders from the common namespace", async ({ page }) => {
    await page.goto("/");
    // Sidebar top-level item — ungated, always visible.
    await expect(page.getByRole("link", { name: "Overview", exact: true })).toBeVisible();

    await page.getByRole("button", { name: /open profile menu/i }).click();
    await expect(page.getByText("Theme", { exact: true })).toBeVisible();
    await expect(page.getByText("Account", { exact: true })).toBeVisible();
  });

  test("switching to Slovenščina localizes the topbar menu and sidebar nav", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /open profile menu/i }).click();
    // The language section keeps the menu open on select, so the surrounding
    // labels re-localize in place.
    await page.getByRole("menuitem", { name: "Slovenščina" }).click();

    await expect(page.getByText("Jezik", { exact: true })).toBeVisible();
    await expect(page.getByText("Tema", { exact: true })).toBeVisible();
    await expect(page.getByText("Račun", { exact: true })).toBeVisible();

    // Sidebar nav re-renders under the new locale too (subscribes to i18n).
    await expect(page.getByRole("link", { name: "Pregled", exact: true })).toBeVisible();
  });
});
