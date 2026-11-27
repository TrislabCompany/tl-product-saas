import { expect, test } from "@playwright/test";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installAdminShellMocks, ADMIN_PERMS, paged } from "../helpers/shell-mocks";
import { mockJsonResponse } from "../helpers/api-mocks";

// The PRODUCER half of the cross-app impersonation handoff.
//
// The dashboard side is pinned by clients/dashboard/tests/impersonation/handoff-locale.spec.ts,
// but nothing asserted that this app actually PUTS the operator's locale in the URL —
// dropping `params.set("locale", …)` left every suite green. The dashboard cannot recover
// the operator's language on its own: the server strips the target's `locale` claim, and
// the two apps normally sit on different origins, and each persists its language under its own
// key (`tl.admin.lng` / `tl.dashboard.lng`), so neither can read the other's.
//
// window.open is stubbed rather than allowed to open a tab: the handoff URL is the thing
// under test, and the real dashboard origin is not served in this suite.

/** The operator's approved request: starting it is what hands the token to the dashboard. */
const APPROVED_REQUEST = {
  id: "req-1",
  actorUserId: TEST_USER.sub,
  actorUserName: "rootadmin",
  actorTenantId: "root",
  targetUserId: "u-target",
  targetUserName: "alice@acme.com",
  targetTenantId: "acme",
  reason: "Investigating a support ticket",
  requestedAtUtc: "2026-05-23T10:00:00Z",
  expiresAtUtc: "2026-05-24T10:00:00Z",
  answeredAtUtc: "2026-05-23T10:05:00Z",
  grantId: null,
  status: "Approved",
};

const TENANT = {
  id: "acme",
  name: "Acme Corp",
  adminEmail: "admin@acme.com",
  isActive: true,
  validUpto: "2027-01-01T00:00:00Z",
};

declare global {
  interface Window {
    __openedUrls?: string[];
  }
}

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, { ...TEST_USER, permissions: [...ADMIN_PERMS] });
  await installAdminShellMocks(page);
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/grants*", []);
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests?**", [APPROVED_REQUEST]);
  await mockJsonResponse(page, "**/api/v1/tenants/theme", { lightPalette: {}, darkPalette: {}, brandAssets: {}, isDefault: true });
  await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged([]));
  await mockJsonResponse(page, "**/api/v1/tenants/acme/status", TENANT);
  await mockJsonResponse(page, "**/api/v1/tenants/acme/provisioning", null);

  await page.route("**/api/v1/identity/impersonation/start", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: "header.payload.sig",
        accessTokenExpiresAt: "2026-05-23T11:00:00Z",
      }),
    });
  });

  await page.addInitScript(() => {
    window.__openedUrls = [];
    window.open = (url?: string | URL) => {
      window.__openedUrls!.push(String(url ?? ""));
      return null;
    };
  });
});

/** Starts the approved request from the tenant page's access requests card. */
async function startApprovedRequest(page: import("@playwright/test").Page, startLabel: string) {
  const main = page.getByRole("main");
  await expect(main.getByText("alice@acme.com", { exact: true })).toBeVisible({ timeout: 10_000 });
  await main.getByRole("button", { name: startLabel }).click();
}

function handoffParams(url: string): URLSearchParams {
  const marker = "#impersonate?";
  const at = url.indexOf(marker);
  expect(at, `handoff URL is not an #impersonate hash handoff: ${url}`).toBeGreaterThan(-1);
  return new URLSearchParams(url.slice(at + marker.length));
}

test.describe("impersonation handoff carries the operator locale", () => {
  test("sends the operator's selected language, not the deployment default", async ({ page }) => {
    // `?culture=` is first in the detection order (lookupQuerystring: "culture"), so this
    // boots the app in Slovenian without touching localStorage.
    await page.goto("/tenants/acme?culture=sl-SI");

    await startApprovedRequest(page, "Začni samo branje");

    await expect.poll(() => page.evaluate(() => window.__openedUrls?.length ?? 0)).toBe(1);
    const opened = (await page.evaluate(() => window.__openedUrls![0]))!;
    const params = handoffParams(opened);

    expect(params.get("locale")).toBe("sl-SI");
    // The pre-existing contract must survive the added parameter.
    expect(params.get("token")).toBe("header.payload.sig");
    expect(params.get("tenant")).toBe("acme");
    expect(params.get("expiresAt")).toBe("2026-05-23T11:00:00Z");
  });

  test("sends en-US when the operator is reading in English", async ({ page }) => {
    await page.goto("/tenants/acme?culture=en-US");

    await startApprovedRequest(page, "Start read-only");

    await expect.poll(() => page.evaluate(() => window.__openedUrls?.length ?? 0)).toBe(1);
    const opened = (await page.evaluate(() => window.__openedUrls![0]))!;
    expect(handoffParams(opened).get("locale")).toBe("en-US");
  });
});
