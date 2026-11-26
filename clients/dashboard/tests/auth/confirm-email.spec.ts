import { expect, test, type Page } from "@playwright/test";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";

const VALID_LINK =
  "/confirm-email?userId=u-1&code=verify-code&tenant=acme";

const PASSWORD = "Str0ng!Passw0rd";

// The owner confirms the address by choosing the account's password: the page is a form, and the
// confirmation and the password go to the server together (POST /confirm-email).
async function submitPassword(page: Page) {
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: /confirm and set password/i }).click();
}

test.describe("confirm-email page", () => {
  test("renders the malformed-link state when params are missing", async ({ page }) => {
    await page.goto("/confirm-email");
    await expect(
      page.getByRole("heading", { name: /couldn't confirm your email/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/missing required parameters/i),
    ).toBeVisible();
  });

  test("asks for the password and fires no request before it is submitted", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/v1/identity/confirm-email**", async (route) => {
      calls++;
      await route.fulfill({ status: 200, contentType: "application/json", body: '"ok"' });
    });

    await page.goto(VALID_LINK);

    await expect(page.getByRole("heading", { name: /confirm your email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm and set password/i })).toBeDisabled();
    expect(calls).toBe(0);
  });

  test("POSTs the code, the user and the password with the link's tenant header", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/confirm-email**", '"Your email is confirmed."');
    await page.goto(VALID_LINK);

    const request = page.waitForRequest(
      (r) => r.url().includes("/api/v1/identity/confirm-email") && r.method() === "POST",
    );
    await submitPassword(page);
    const sent = await request;

    expect(new URL(sent.url()).search).toBe("");
    expect(sent.headers()["tenant"]).toBe("acme");
    expect(sent.postDataJSON()).toEqual({ userId: "u-1", code: "verify-code", password: PASSWORD });

    await expect(page.getByRole("heading", { name: /email confirmed/i })).toBeVisible();
    await expect(page.getByText(/your email is confirmed/i)).toBeVisible();
  });

  test("keeps the form open when the server rejects the password", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/identity/confirm-email**", 400, {
      title: "Weak password",
      detail: "Passwords must have at least one non alphanumeric character.",
    });
    await page.goto(VALID_LINK);

    await submitPassword(page);

    await expect(page.getByRole("alert")).toContainText(/non alphanumeric/i);
    await expect(page.getByLabel("New password")).toBeVisible();
  });

  test("surfaces an expired link as an actionable failure state", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/identity/confirm-email**", 410, {
      title: "Invalid token",
      detail: "The confirmation token is no longer valid.",
    });
    await page.goto(VALID_LINK);

    await submitPassword(page);

    await expect(
      page.getByRole("heading", { name: /couldn't confirm/i }),
    ).toBeVisible();
    await expect(page.getByText(/no longer valid/i)).toBeVisible();

    // The error state offers BOTH "back to sign in" and "reset password" —
    // a stuck user has a recovery path. The footer also renders a
    // "← Back to sign in" link, so we exact-match the in-card button.
    await expect(page.getByRole("link", { name: "Back to sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /reset password instead/i })).toBeVisible();
  });

  test("'continue to sign in' link routes to /login", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/confirm-email**", '"Your email is confirmed."');
    await page.goto(VALID_LINK);

    await submitPassword(page);
    await page.getByRole("link", { name: /continue to sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
