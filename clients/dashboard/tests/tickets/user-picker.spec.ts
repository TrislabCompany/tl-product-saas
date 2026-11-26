import { expect, test } from "@playwright/test";
import { mockJsonResponse } from "../helpers/api-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";

const TICKET_ID = "00000000-0000-0000-0000-000000000abc";

const TICKET = {
  id: TICKET_ID,
  number: "TK-1",
  title: "Login button broken on mobile",
  description: "Tap-target collision on iOS Safari.",
  status: "Open",
  priority: "High",
  reporterUserId: "00000000-0000-0000-0000-000000000111",
  assignedToUserId: null,
  resolutionNote: null,
  createdAtUtc: "2026-05-10T10:00:00Z",
  updatedAtUtc: null,
  resolvedAtUtc: null,
  closedAtUtc: null,
  commentCount: 0,
  deletedOnUtc: null,
  deletedBy: null,
};

// GET /identity/users/lookup: what every member may see to pick a user (Users.Pick). No e-mail.
const LOOKUP_HITS = [
  {
    id: "00000000-0000-0000-0000-000000000222",
    userName: "bob",
    firstName: "Bob",
    lastName: "Patel",
    imageUrl: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000333",
    userName: "carol",
    firstName: "Carol",
    lastName: "Smith",
    imageUrl: null,
  },
];

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await mockJsonResponse(page, "**/api/v1/identity/profile", {
    id: TEST_USER.sub,
    userName: "alice",
    email: TEST_USER.email,
    firstName: TEST_USER.firstName,
    lastName: TEST_USER.lastName,
    isActive: true,
    emailConfirmed: true,
    twoFactorEnabled: false,
  });
  await mockJsonResponse(page, `**/api/v1/tickets/${TICKET_ID}`, TICKET);
  // listTicketComments returns a plain array, not a paged response.
  await mockJsonResponse(page, `**/api/v1/tickets/${TICKET_ID}/comments**`, []);
  await mockJsonResponse(page, "**/api/v1/identity/users/lookup**", LOOKUP_HITS);
});

test.describe("ticket assignee — user picker", () => {
  test("opens the Assign dialog and shows the typeahead search input", async ({ page }) => {
    await page.goto(`/tickets/${TICKET_ID}`);
    await page.getByRole("button", { name: /^Assign$/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/search by name/i)).toBeVisible();
  });

  test("typing fires a debounced lookup and renders results", async ({ page }) => {
    await page.goto(`/tickets/${TICKET_ID}`);
    await page.getByRole("button", { name: /^Assign$/i }).first().click();
    const dialog = page.getByRole("dialog");

    const lookup = page.waitForRequest((r) => r.url().includes("/api/v1/identity/users/lookup"));
    await dialog.getByPlaceholder(/search by name/i).fill("bob");
    // The picker goes through the lookup (Users.Pick), never the Admin-only user search.
    expect(new URL((await lookup).url()).searchParams.get("search")).toBe("bob");

    // Debounce is 250ms — give the listbox time to materialise.
    await expect(dialog.getByRole("listbox")).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByRole("option").first()).toContainText(/bob patel/i);
    await expect(dialog.getByRole("option").first()).toContainText("@bob");
  });

  test("one typed character searches nobody (the lookup needs two)", async ({ page }) => {
    let lookups = 0;
    await page.route("**/api/v1/identity/users/lookup**", async (route) => {
      // The page also looks up the reporter's name by id; count the searches only.
      if (new URL(route.request().url()).searchParams.has("search")) lookups++;
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto(`/tickets/${TICKET_ID}`);
    await page.getByRole("button", { name: /^Assign$/i }).first().click();

    await page.getByRole("dialog").getByPlaceholder(/search by name/i).fill("b");
    await page.waitForTimeout(600);
    expect(lookups).toBe(0);
  });

  test("picking a result fills the selected chip with the name", async ({ page }) => {
    await page.goto(`/tickets/${TICKET_ID}`);
    await page.getByRole("button", { name: /^Assign$/i }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByPlaceholder(/search by name/i).fill("bob");
    await dialog.getByRole("option", { name: /bob patel/i }).click();

    // Dropdown closes; the chip with the name is now visible above the
    // input, with a clear button.
    await expect(dialog.getByRole("listbox")).not.toBeVisible();
    await expect(dialog.getByText("Bob Patel")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /clear/i })).toBeVisible();
  });

  test("submitting POSTs the picked id to the assign endpoint", async ({ page }) => {
    await mockJsonResponse(
      page,
      `**/api/v1/tickets/${TICKET_ID}/assign`,
      TICKET,
    );

    await page.goto(`/tickets/${TICKET_ID}`);
    await page.getByRole("button", { name: /^Assign$/i }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByPlaceholder(/search by name/i).fill("bob");
    await dialog.getByRole("option", { name: /bob patel/i }).click();

    const reqPromise = page.waitForRequest(
      (r) => r.url().endsWith(`/tickets/${TICKET_ID}/assign`) && r.method() === "POST",
      { timeout: 5_000 },
    );
    await dialog.getByRole("button", { name: /save assignment/i }).click();
    const req = await reqPromise;

    expect(JSON.parse(req.postData() ?? "{}")).toMatchObject({
      assigneeUserId: "00000000-0000-0000-0000-000000000222",
    });
  });

  test("Clear unselects the user (POSTs assignedToUserId: null)", async ({ page }) => {
    await mockJsonResponse(
      page,
      `**/api/v1/tickets/${TICKET_ID}/assign`,
      TICKET,
    );

    await page.goto(`/tickets/${TICKET_ID}`);
    await page.getByRole("button", { name: /^Assign$/i }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByPlaceholder(/search by name/i).fill("bob");
    await dialog.getByRole("option", { name: /bob patel/i }).click();
    await dialog.getByRole("button", { name: /clear/i }).click();

    const reqPromise = page.waitForRequest(
      (r) => r.url().endsWith(`/tickets/${TICKET_ID}/assign`) && r.method() === "POST",
      { timeout: 5_000 },
    );
    await dialog.getByRole("button", { name: /save assignment/i }).click();
    const req = await reqPromise;

    const body = JSON.parse(req.postData() ?? "{}");
    expect(body.assigneeUserId).toBeNull();
  });
});
