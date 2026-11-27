import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks } from "../helpers/shell-mocks";

// The palette matches on the visible label *and* on per-action keywords. Those
// keywords used to be English literals in the component, so a sl-SI user could read
// every label in their language and still have to guess the English term to find
// anything by search. They now live in the catalog like any other string.

/**
 * The palette's shortcut listener attaches in an effect after the shell paints, so a visible shell doesn't mean
 * the shortcut works yet; under load the first press was lost. Press until the palette opens.
 */
async function openPalette(page: Page, search: Locator) {
  await expect(async () => {
    if (!(await search.isVisible())) await page.keyboard.press("Control+k");
    await expect(search).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
});

test.describe("command palette search terms", () => {
  test("sl-SI keywords match, and the English ones no longer do", async ({ page }) => {
    await page.goto("/?culture=sl-SI");
    await expect(page.getByRole("button", { name: "Odpri meni profila" })).toBeVisible();
    const search = page.getByPlaceholder("Vnesite ukaz ali iščite…");
    await openPalette(page, search);

    // "noč" appears in no label — only in the sl-SI keywords for the dark theme.
    await search.fill("noč");
    await expect(page.getByRole("option", { name: "Preklopi na temno" })).toBeVisible();

    // And the catalog really switched: the English keyword is not also matching.
    await search.fill("night");
    await expect(page.getByRole("option", { name: "Preklopi na temno" })).toBeHidden();
  });

  test("en-US keywords still match", async ({ page }) => {
    await page.goto("/?culture=en-US");
    await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible();
    const search = page.getByPlaceholder("Type a command or search…");
    await openPalette(page, search);

    await search.fill("oled");
    await expect(page.getByRole("option", { name: "Switch to dark" })).toBeVisible();
  });
});
