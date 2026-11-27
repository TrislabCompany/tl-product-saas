import { chromium, type FullConfig } from "@playwright/test";

/**
 * Warms the Vite dev server once before any test runs. On a cold start Vite scans and bundles the
 * dependencies when the first page asks for them, and the first tests of every worker used to time out
 * while it did (CI hid it behind its retries). vite.config.ts scans every source file up front
 * (`optimizeDeps.entries`), so after this one page load no lazy route triggers a second bundling.
 * It uses the default Chromium and loads only the sign-in page, which is enough while every route's
 * dependencies come from the same scan. Keep it the same as clients/admin/tests/helpers/global-setup.ts.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("globalSetup: the Playwright config sets no baseURL to warm up.");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // No backend runs in the tests; the sign-in page needs none.
    await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({ status: 404, body: "" }));
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: "networkidle", timeout: 180_000 });
    } catch (error) {
      throw new Error(`globalSetup: the dev server warm-up failed at ${baseURL}/login.`, { cause: error });
    }
  } finally {
    await browser.close();
  }
}
