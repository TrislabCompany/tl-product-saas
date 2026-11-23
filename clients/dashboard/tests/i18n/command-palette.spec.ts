import { expect, test } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks } from "../helpers/shell-mocks";

// The palette matches on the visible label *and* on per-action keywords. Those
// keywords used to be English literals in the component, so a sl-SI user could read
// every label in their language and still have to guess the English term to find
// anything by search. They now live in the catalog like any other string.

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
});

test.describe("command palette search terms", () => {
  test("sl-SI keywords match, and the English ones no longer do", async ({ page }) => {
    await page.goto("/?culture=sl-SI");
    // The sl-SI catalog loads before the first render, after the load event: a shortcut pressed
    // before the shell mounts has no listener to reach.
    await expect(page.getByRole("button", { name: "Odpri meni profila" })).toBeVisible();
    await page.keyboard.press("Control+k");

    const search = page.getByPlaceholder("Vnesite ukaz ali iščite…");
    await expect(search).toBeVisible();

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
    await page.keyboard.press("Control+k");

    const search = page.getByPlaceholder("Type a command or search…");
    await expect(search).toBeVisible();

    await search.fill("oled");
    await expect(page.getByRole("option", { name: "Switch to dark" })).toBeVisible();
  });
});
