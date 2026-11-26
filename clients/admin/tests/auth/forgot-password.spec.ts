import { expect, test } from "@playwright/test";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";

test.describe("admin forgot-password", () => {
  test("renders the reset-password request form", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
    await expect(page.getByText(/dispatch a one-time link/i)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    // Users are global: the form asks only for the e-mail.
    await expect(page.getByLabel("Tenant")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("posts the e-mail to /forgot-password with no tenant header", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("operator@root.example");
  
    const reqPromise = page.waitForRequest(
      (r) =>
        r.url().includes("/api/v1/identity/forgot-password") && r.method() === "POST",
      { timeout: 5_000 },
    );
    await mockJsonResponse(page, "**/api/v1/identity/forgot-password", '""');
    await page.getByRole("button", { name: /send reset link/i }).click();
    const req = await reqPromise;

    expect(JSON.parse(req.postData() ?? "{}")).toMatchObject({
      email: "operator@root.example",
    });
    expect(req.headers().tenant).toBeUndefined();
  });

  test("shows the 'check your inbox' success state after 200", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/forgot-password", '""');

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("alice@acme.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
    await expect(page.getByText("alice@acme.com", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /try a different address/i })).toBeVisible();
  });

  test("surfaces server errors inline", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/identity/forgot-password", 500, {
      title: "Server error",
      detail: "The reset service is unavailable.",
    });

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("a@b.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByRole("alert")).toContainText(/reset service is unavailable/i);
    await expect(page.getByRole("heading", { name: /check your inbox/i })).not.toBeVisible();
  });
});
