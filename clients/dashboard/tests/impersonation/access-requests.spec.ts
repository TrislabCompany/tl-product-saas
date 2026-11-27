import { expect, test, type Page } from "@playwright/test";
import { mockJsonResponse } from "../helpers/api-mocks";
import {
  IMPERSONATED_USER,
  OPERATOR_ACTOR,
  seedAuthedSession,
  seedImpersonationSession,
  TEST_USER,
} from "../helpers/auth-seed";
import { grantPermissions, installShellMocks, SHELL_PERMISSIONS } from "../helpers/shell-mocks";

// Impersonation only reads and needs the user's approval (D-44). The user answers every request in a notice
// under the top bar; an actor (here a tenant Admin) requests access on a user's page and starts it once approved.

const request = (over: Record<string, unknown>) => ({
  id: "req-1",
  actorUserId: "op-root-1",
  actorUserName: "Root Operator",
  actorTenantId: "root",
  targetUserId: TEST_USER.sub,
  targetUserName: TEST_USER.email,
  targetTenantId: "acme",
  reason: "Customer ticket 4821",
  requestedAtUtc: "2026-05-23T10:00:00Z",
  expiresAtUtc: "2026-05-24T10:00:00Z",
  answeredAtUtc: null,
  grantId: null,
  status: "Pending",
  ...over,
});

async function signIn(page: Page, mine: unknown[]) {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
  await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests/mine", mine);
}

/** Records the answers and returns 200 with the request. */
async function recordAnswers(page: Page): Promise<string[]> {
  const answers: string[] = [];
  await page.route("**/api/v1/identity/impersonation/requests/*/*", async (route) => {
    answers.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(request({})) });
  });
  return answers;
}

test.describe("the access requests notice", () => {
  test("names who asks and why; Approve answers it", async ({ page }) => {
    await signIn(page, [request({})]);
    const answers = await recordAnswers(page);

    await page.goto("/");

    const notice = page.getByRole("region", { name: "Requests to see your account" });
    await expect(notice.getByText("Root Operator asks to see your account, read-only.")).toBeVisible();
    await expect(notice.getByText(/Reason: Customer ticket 4821/)).toBeVisible();
    await notice.getByRole("button", { name: "Approve" }).click();

    await expect.poll(() => answers).toEqual(["/api/v1/identity/impersonation/requests/req-1/approve"]);
    await expect(page.getByText("Root Operator may now see your account, read-only")).toBeVisible();
  });

  test("Deny answers it", async ({ page }) => {
    await signIn(page, [request({})]);
    const answers = await recordAnswers(page);

    await page.goto("/");
    await page.getByRole("region", { name: "Requests to see your account" }).getByRole("button", { name: "Deny" }).click();

    await expect.poll(() => answers).toEqual(["/api/v1/identity/impersonation/requests/req-1/deny"]);
  });

  test("an approval can be taken back", async ({ page }) => {
    await signIn(page, [request({ id: "req-approved", status: "Approved" })]);
    const answers = await recordAnswers(page);

    await page.goto("/");
    const notice = page.getByRole("region", { name: "Requests to see your account" });
    await expect(notice.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await notice.getByRole("button", { name: "Take back" }).click();

    await expect.poll(() => answers).toEqual(["/api/v1/identity/impersonation/requests/req-approved/deny"]);
  });

  test("a running impersonation can be ended", async ({ page }) => {
    await signIn(page, [request({ id: "req-used", status: "Used", grantId: "g-1", actorUserName: "Support Agent" })]);
    const answers = await recordAnswers(page);

    await page.goto("/");
    const notice = page.getByRole("region", { name: "Requests to see your account" });
    await expect(notice.getByText("Support Agent is seeing your account now, read-only.")).toBeVisible();
    await notice.getByRole("button", { name: "End now" }).click();

    await expect.poll(() => answers).toEqual(["/api/v1/identity/impersonation/requests/req-used/deny"]);
  });

  test("nothing to answer, no notice", async ({ page }) => {
    await signIn(page, []);
    await page.goto("/");

    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Requests to see your account" })).toHaveCount(0);
  });

  test("without Impersonation.Respond the requests aren't asked for", async ({ page }) => {
    await signIn(page, [request({})]);
    await mockJsonResponse(
      page,
      "**/api/v1/identity/permissions",
      SHELL_PERMISSIONS.filter((p) => p !== "Permissions.Impersonation.Respond"),
    );
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/impersonation/requests/mine")) asked.push(r.url());
    });

    await page.goto("/");
    await expect(page.getByRole("heading").first()).toBeVisible();

    await expect(page.getByRole("region", { name: "Requests to see your account" })).toHaveCount(0);
    expect(asked).toEqual([]);
  });
});

test.describe("while impersonating", () => {
  test("the banner says it only reads, and no request is asked about", async ({ page }) => {
    await seedImpersonationSession(page, IMPERSONATED_USER, OPERATOR_ACTOR);
    await installShellMocks(page);
    await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests/mine", [request({})]);

    await page.goto("/");

    await expect(page.getByText(/read-only/i).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Requests to see your account" })).toHaveCount(0);
  });
});

test.describe("a user's page", () => {
  const BOB = {
    id: "00000000-0000-0000-0000-0000000000b0",
    userName: "bob",
    firstName: "Bob",
    lastName: "Patel",
    email: "bob@acme.com",
    isActive: true,
    emailConfirmed: true,
  };

  async function openBob(page: Page, sent: unknown[]) {
    await signIn(page, []);
    await grantPermissions(page, ["Permissions.Users.Update", "Permissions.Users.Impersonate"]);
    await mockJsonResponse(page, `**/api/v1/identity/users/${BOB.id}/roles`, []);
    await mockJsonResponse(page, `**/api/v1/identity/users/${BOB.id}/sessions`, []);
    await mockJsonResponse(page, `**/api/v1/identity/users/${BOB.id}`, BOB);
    await mockJsonResponse(page, "**/api/v1/identity/impersonation/requests?**", sent, { method: "GET" });
    await page.goto(`/identity/users/${BOB.id}`);
    await expect(page.getByRole("heading", { name: "Bob Patel", level: 1 })).toBeVisible();
  }

  test("asks Bob for access with a reason; nothing starts yet", async ({ page }) => {
    const posted: Record<string, unknown>[] = [];
    let started = false;
    await page.route("**/api/v1/identity/impersonation/requests", async (route) => {
      posted.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(request({})) });
    });
    await page.route("**/api/v1/identity/impersonation/start", async (route) => {
      started = true;
      await route.abort();
    });
    await openBob(page, []);

    await page.getByRole("button", { name: "Request access" }).click();
    const dialog = page.getByRole("dialog");
    const send = dialog.getByRole("button", { name: "Request read-only access" });
    await expect(send).toBeDisabled();
    await dialog.getByRole("textbox").fill("Checking a reported bug");
    await send.click();

    await expect(page.getByText("Access requested", { exact: true })).toBeVisible();
    expect(posted).toEqual([{ targetUserId: BOB.id, targetTenantId: "acme", reason: "Checking a reported bug" }]);
    expect(started).toBe(false);
  });

  test("a pending request waits for Bob", async ({ page }) => {
    await openBob(page, [request({ targetUserId: BOB.id, status: "Pending" })]);

    await expect(page.getByRole("button", { name: "Waiting for approval" })).toBeDisabled();
  });

  test("an approved request starts with its id", async ({ page }) => {
    const starts: Record<string, unknown>[] = [];
    await page.route("**/api/v1/identity/impersonation/start", async (route) => {
      starts.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.fulfill({
        status: 403,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "Forbidden", status: 403, detail: "The user denied this request." }),
      });
    });
    await openBob(page, [request({ id: "req-bob", targetUserId: BOB.id, status: "Approved" })]);

    await page.getByRole("button", { name: "Start read-only" }).click();

    await expect.poll(() => starts).toEqual([{ requestId: "req-bob", durationMinutes: null }]);
    await expect(page.getByText("The user denied this request.")).toBeVisible();
  });
});
