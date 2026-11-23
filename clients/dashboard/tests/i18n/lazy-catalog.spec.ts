import { expect, test } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks } from "../helpers/shell-mocks";

// Only en-US ships in the main bundle; sl-SI is one lazy chunk (src/locales/sl-SI.ts). That makes
// two failure modes possible that a static import could not have: a sl-SI user seeing English
// until the chunk lands, and a catalog that never arrives. In dev the "chunk" is the module request
// for src/locales/sl-SI.ts and its JSON files; in a build it is assets/sl-SI-<hash>.js.
const PT_BR_CATALOG = /\/(src\/locales\/sl-SI|assets\/sl-SI-)/;

test.describe("lazy sl-SI catalog", () => {
  test("a sl-SI catalog that fails at boot leaves every language signal on English", async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
    await page.route(PT_BR_CATALOG, (route) => route.abort());

    const profileReq = page.waitForRequest(
      (r) => r.url().includes("/api/v1/identity/profile") && r.method() === "GET",
    );
    await page.goto("/?culture=sl-SI");

    // The text falls back to English, so the document, the API and the switcher must say so too:
    // a sl-SI lang over English text misleads screen readers and asks the API for Slovenian.
    await expect(page.getByRole("button", { name: /open profile menu/i })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    expect((await profileReq).headers()["accept-language"]).toBe("en-US");
  });

  test("a sl-SI visitor gets Slovenian on the first render, never English first", async ({ page }) => {
    // Record every state the app root goes through, from before the app's own scripts run.
    await page.addInitScript(() => {
      const w = window as unknown as { __sawEnglish: boolean };
      w.__sawEnglish = false;
      new MutationObserver(() => {
        if (document.getElementById("root")?.textContent?.includes("Trislab Administration")) {
          w.__sawEnglish = true;
        }
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    // A slow catalog is what turns a missing await into a visible English first paint; on a fast
    // local dev server the lazy route chunk alone can hide it.
    await page.route(PT_BR_CATALOG, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.continue();
    });

    await page.goto("/login?culture=sl-SI");

    await expect(page.getByText("Administracija Trislab").first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __sawEnglish: boolean }).__sawEnglish)).toBe(false);
  });

  test("a switch whose catalog fails to load stays in English and saves nothing", async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);

    let profilePuts = 0;
    await page.route("**/api/v1/identity/profile", async (route) => {
      if (route.request().method() === "PUT") profilePuts++;
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "u-test-1",
          firstName: "Alice",
          lastName: "Nguyen",
          phoneNumber: "",
          email: TEST_USER.email,
          isActive: true,
          emailConfirmed: true,
          locale: "en-US",
        }),
      });
    });
    await page.route(PT_BR_CATALOG, (route) => route.abort());

    await page.goto("/?culture=en-US");
    await page.getByRole("button", { name: /open profile menu/i }).click();
    await page.getByRole("menuitem", { name: "Slovenščina" }).click();

    await expect(page.getByText("Language not changed")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    expect(await page.evaluate(() => localStorage.getItem("tl.dashboard.lng"))).toBe("en-US");
    expect(profilePuts).toBe(0);
  });
});
