import { expect, test } from "@playwright/test";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";

const TENANT_ID = "acme";

// The operator only reads inside a tenant (D-44): the card is a preview, and the tenant's Admins change their
// branding in the dashboard. The page's RouteGuard needs Tenants.View; ViewTheme is what the read needs.
const ROOT_PERMS = [
  "Permissions.Tenants.View",
  "Permissions.Tenants.ViewTheme",
];

const TENANT = {
  id: TENANT_ID,
  name: "Acme Corp",
  adminEmail: "admin@acme.com",
  isActive: true,
  validUpto: "2027-01-01T00:00:00Z",
  issuer: "tl.demo.acme",
};

const PROVISIONING = {
  status: "Completed",
  currentStep: "CacheWarm",
  correlationId: "abc-123",
  steps: [],
  startedUtc: "2026-05-10T10:00:00Z",
  completedUtc: "2026-05-10T10:00:08Z",
  error: null,
};

const THEME_DEFAULT = {
  lightPalette: {
    primary: "#2563EB",
    secondary: "#0F172A",
    tertiary: "#6366F1",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    error: "#DC2626",
    warning: "#F59E0B",
    success: "#16A34A",
    info: "#0284C7",
  },
  darkPalette: {
    primary: "#38BDF8",
    secondary: "#94A3B8",
    tertiary: "#818CF8",
    background: "#0B1220",
    surface: "#111827",
    error: "#F87171",
    warning: "#FBBF24",
    success: "#22C55E",
    info: "#38BDF8",
  },
  brandAssets: {
    logoUrl: null,
    logoDarkUrl: null,
    faviconUrl: null,
    deleteLogo: false,
    deleteLogoDark: false,
    deleteFavicon: false,
  },
  typography: {
    fontFamily: "Inter, sans-serif",
    headingFontFamily: "Inter, sans-serif",
    fontSizeBase: 14,
    lineHeightBase: 1.5,
  },
  layout: { borderRadius: "4px", defaultElevation: 1 },
  isDefault: true,
};

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, { ...TEST_USER, permissions: ROOT_PERMS });
  await mockJsonResponse(page, "**/api/v1/identity/profile", {
    id: TEST_USER.sub,
    email: TEST_USER.email,
    isActive: true,
    emailConfirmed: true,
  });
  await mockJsonResponse(page, "**/api/v1/identity/permissions", []);
  await mockJsonResponse(page, `**/api/v1/tenants/${TENANT_ID}/status`, TENANT);
  await mockJsonResponse(
    page,
    `**/api/v1/tenants/${TENANT_ID}/provisioning`,
    PROVISIONING,
  );
  // Active grants list — not under test here, return empty.
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/grants**", []);
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests?**", []);
});

const THEME_CUSTOM = {
  ...THEME_DEFAULT,
  lightPalette: { ...THEME_DEFAULT.lightPalette, primary: "#FF5500" },
  brandAssets: { ...THEME_DEFAULT.brandAssets, logoUrl: "https://cdn.example.com/acme.svg" },
  isDefault: false,
};

test.describe("tenant branding card", () => {
  test("shows the theme read through the tenant header, with the default badge", async ({ page }) => {
    const reads: string[] = [];
    await page.route("**/api/v1/tenants/theme", async (route) => {
      reads.push(route.request().headers().tenant ?? "");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(THEME_DEFAULT) });
    });

    await page.goto(`/tenants/${TENANT_ID}`);

    await expect(page.getByText(/light palette/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/dark palette/i)).toBeVisible();
    await expect(page.locator("text=/^default$/i").first()).toBeVisible();
    await expect(page.locator("text=/^read-only$/i").first()).toBeVisible();
    await expect(page.getByText("#2563EB").first()).toBeVisible();
    expect(reads).toContain(TENANT_ID);
  });

  test("shows a tenant's own colours and logo address", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/tenants/theme", THEME_CUSTOM);

    await page.goto(`/tenants/${TENANT_ID}`);

    await expect(page.getByText("#FF5500")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("https://cdn.example.com/acme.svg")).toBeVisible();
    await expect(page.locator("text=/^default$/i")).toHaveCount(0);
  });

  test("offers no way to change it: no field, no save, no reset, and nothing is written", async ({ page }) => {
    const writes: string[] = [];
    await page.route("**/api/v1/tenants/theme**", async (route) => {
      if (route.request().method() !== "GET") writes.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(THEME_DEFAULT) });
    });

    await page.goto(`/tenants/${TENANT_ID}`);
    const card = page.locator("section").filter({ hasText: /light palette/i });
    await expect(card).toBeVisible({ timeout: 10_000 });

    await expect(card.locator("input")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /save branding/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /reset/i })).toHaveCount(0);
    await expect(card.getByText(/dashboard/i).first()).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("surfaces a server error in the error band", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/tenants/theme", 403, {
      title: "Forbidden",
      detail: "Tenant theme is not visible to this caller.",
    });

    await page.goto(`/tenants/${TENANT_ID}`);
    await expect(page.getByText(/not visible to this caller/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
