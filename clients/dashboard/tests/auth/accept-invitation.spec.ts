import { expect, test, type Page } from "@playwright/test";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";
import { fakeJwt, seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks } from "../helpers/shell-mocks";

// The page an invitation e-mail links to: /accept-invitation?token=…&new=1|0. Users are global:
// a new address sets its password here; a confirmed account signs in and accepts.

const ACCEPT = "**/api/v1/identity/invitations/accept";
const PASSWORD = "Str0ng!Passw0rd";

async function fillNewAccount(page: Page) {
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Reyes");
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
}

test.describe("accept-invitation — a new address", () => {
  test("sets the password and the name, anonymously, and offers to sign in", async ({ page }) => {
    await mockJsonResponse(page, ACCEPT, { tenant: "acme", tenantName: "Acme Corp" });
    await page.goto("/accept-invitation?token=tok%2B1&new=1");

    await expect(page.getByRole("heading", { name: /accept your invitation/i })).toBeVisible();
    await fillNewAccount(page);

    const request = page.waitForRequest((r) => r.url().includes("/invitations/accept") && r.method() === "POST");
    await page.getByRole("button", { name: /accept invitation/i }).click();
    const sent = await request;

    expect(sent.postDataJSON()).toEqual({ token: "tok+1", password: PASSWORD, firstName: "Dana", lastName: "Reyes" });
    expect(sent.headers()["authorization"]).toBeUndefined();

    await expect(page.getByRole("heading", { name: /invitation accepted/i })).toBeVisible();
    await expect(page.getByText(/member of acme corp/i)).toBeVisible();
    await page.getByRole("link", { name: /continue to sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("keeps the form when the server rejects the password", async ({ page }) => {
    await mockProblemDetails(page, ACCEPT, 400, {
      title: "Weak password",
      detail: "Passwords must have at least one digit.",
    });
    await page.goto("/accept-invitation?token=tok&new=1");
    await fillNewAccount(page);
    await page.getByRole("button", { name: /accept invitation/i }).click();

    await expect(page.getByRole("alert")).toContainText(/at least one digit/i);
    await expect(page.getByLabel("New password")).toBeVisible();
  });

  test("an expired or revoked link ends in a failure state with a way back", async ({ page }) => {
    await mockProblemDetails(page, ACCEPT, 410, { title: "Gone", detail: "This invitation is no longer valid." });
    await page.goto("/accept-invitation?token=tok&new=1");
    await fillNewAccount(page);
    await page.getByRole("button", { name: /accept invitation/i }).click();

    await expect(page.getByRole("heading", { name: /couldn't accept the invitation/i })).toBeVisible();
    await expect(page.getByText(/no longer valid/i)).toBeVisible();
  });

  test("a link without a token says so", async ({ page }) => {
    await page.goto("/accept-invitation");
    await expect(page.getByText(/missing its token/i)).toBeVisible();
  });
});

test.describe("accept-invitation — an existing account", () => {
  test("signed out: asks to sign in, and the sign-in comes back to the link", async ({ page }) => {
    await page.goto("/accept-invitation?token=tok&new=0");

    await expect(page.getByRole("heading", { name: /sign in to accept/i })).toBeVisible();
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signed in: accepts with the session and opens the new tenant", async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
    await mockJsonResponse(page, ACCEPT, { tenant: "globex", tenantName: "Globex" });
    await mockJsonResponse(page, "**/api/v1/identity/token/switch", {
      accessToken: fakeJwt({ sub: TEST_USER.sub, tenant: "globex", exp: Math.floor(Date.now() / 1000) + 3600 }),
      refreshToken: "refresh-2",
      tenant: "globex",
      tenantSelectionRequired: false,
    });
    await page.goto("/accept-invitation?token=tok&new=0");
    await expect(page.getByRole("heading", { name: /join a new organisation/i })).toBeVisible();

    const accept = page.waitForRequest((r) => r.url().includes("/invitations/accept"));
    await page.getByRole("button", { name: /accept invitation/i }).click();
    const sent = await accept;
    expect(sent.postDataJSON()).toEqual({ token: "tok" });
    expect(sent.headers()["authorization"]).toMatch(/^Bearer /);

    const switched = page.waitForRequest((r) => r.url().includes("/token/switch"));
    await page.getByRole("button", { name: /open globex/i }).click();
    expect((await switched).postDataJSON()).toEqual({ tenant: "globex", setDefault: false });
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem("tl.dashboard.tenant"))).toBe("globex");
  });

  test("a new-account link for an address that is confirmed by now asks to sign in", async ({ page }) => {
    await page.route(ACCEPT, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/problem+json",
        body: JSON.stringify({ status: 401, title: "Unauthorized", code: "Identity.InvitationSignInRequired" }),
      }),
    );

    await page.goto("/accept-invitation?token=tok&new=1");
    await fillNewAccount(page);
    await page.getByRole("button", { name: /accept invitation/i }).click();

    await expect(page.getByRole("heading", { name: /sign in to accept/i })).toBeVisible();
  });
});
