import type { Page, Route } from "@playwright/test";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export async function mockJsonResponse<T>(
  page: Page,
  urlGlob: string,
  body: T,
  options: { method?: string; status?: number } = {},
) {
  await page.route(urlGlob, async (route: Route) => {
    if (options.method && route.request().method() !== options.method) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: options.status ?? 200,
      headers: JSON_HEADERS,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  });
}

export async function mockProblemDetails(
  page: Page,
  urlGlob: string,
  status: number,
  problem: { title?: string; detail?: string; errors?: Record<string, string[]> },
) {
  await page.route(urlGlob, async (route: Route) => {
    await route.fulfill({
      status,
      headers: { "Content-Type": "application/problem+json" },
      body: JSON.stringify({
        type: `https://httpstatuses.io/${status}`,
        title: problem.title ?? "Error",
        status,
        detail: problem.detail,
        errors: problem.errors,
      }),
    });
  });
}

/**
 * Answers every API call no test mocked with a 404 problem, instead of letting it reach the Vite proxy, which has
 * no backend in the tests and fills the log with ECONNREFUSED. It is a route of the browser context, and the page's
 * own routes always win over the context's, so every mock a test registers on the page wins, before or after this.
 * The detail names the call, so a missing mock shows. A page route that calls `route.fallback()` ends here too.
 * Keep it the same as mockUnmatchedApi in clients/dashboard/tests/helpers/api-mocks.ts.
 */
export async function mockUnmatchedApi(page: Page) {
  // A URL predicate, not the glob "**/api/**", which also matches the app's own modules (/src/api/users.ts).
  await page.context().route((url) => url.pathname.startsWith("/api/"), async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    await route.fulfill({
      status: 404,
      headers: { "Content-Type": "application/problem+json" },
      body: JSON.stringify({
        type: "https://httpstatuses.io/404",
        title: "Not mocked",
        status: 404,
        detail: `No test mock for ${route.request().method()} ${pathname}`,
      }),
    });
  });
}
