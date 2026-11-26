import { expect, test, type Page } from "@playwright/test";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";

const VALID_LINK = "/confirm-email?userId=u-1&code=verify-code&tenant=root";
const PASSWORD = "Str0ng!Passw0rd";

// The owner confirms the address by choosing the account's password (POST /confirm-email).
async function submitPassword(page: Page) {
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: /confirm and set password/i }).click();
}

test.describe("admin confirm-email", () => {
  test("malformed-link state when params are missing", async ({ page }) => {
    await page.goto("/confirm-email");
    await expect(page.getByText(/missing required parameters/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /couldn't confirm your email/i })).toBeVisible();
  });

  test("POSTs the code and the password, then the success state with continue-to-signin", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/confirm-email**", '"Your email is confirmed."');
    await page.goto(VALID_LINK);

    const request = page.waitForRequest((r) => r.url().includes("/confirm-email") && r.method() === "POST");
    await submitPassword(page);
    const sent = await request;
    expect(sent.headers()["tenant"]).toBe("root");
    expect(sent.postDataJSON()).toEqual({ userId: "u-1", code: "verify-code", password: PASSWORD });

    await expect(page.getByText(/your email is confirmed/i)).toBeVisible();
    const cta = page.getByRole("link", { name: /continue to sign in/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a rejected password keeps the form", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/identity/confirm-email**", 400, {
      title: "Weak password",
      detail: "Passwords must have at least one digit.",
    });
    await page.goto(VALID_LINK);
    await submitPassword(page);

    await expect(page.getByRole("alert")).toContainText(/at least one digit/i);
    await expect(page.getByLabel("New password")).toBeVisible();
  });

  test("an expired link ends in the failure state with recovery affordances", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/identity/confirm-email**", 410, {
      title: "Invalid token",
      detail: "The confirmation token is no longer valid.",
    });
    await page.goto(VALID_LINK);
    await submitPassword(page);

    await expect(page.getByText(/no longer valid/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /reset password instead/i })).toBeVisible();
  });
});
