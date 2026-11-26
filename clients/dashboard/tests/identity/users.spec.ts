import { expect, test } from "@playwright/test";
import { mockJsonResponse } from "../helpers/api-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { installShellMocks, paged } from "../helpers/shell-mocks";

// A pair of users for the search results. We assert on "Bob Patel" which
// only appears in our mock data — never in the shell defaults.
const USERS = [
  {
    id: "00000000-0000-0000-0000-0000000000b0",
    userName: "bob",
    firstName: "Bob",
    lastName: "Patel",
    email: "bob@acme.com",
    isActive: true,
    emailConfirmed: true,
  },
  {
    id: "00000000-0000-0000-0000-0000000000c0",
    userName: "carol",
    firstName: "Carol",
    lastName: "Smith",
    email: "carol@acme.com",
    isActive: false,
    emailConfirmed: false,
  },
];

const ROLES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Admin", description: "Full access" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Manager", description: "Manage users" },
];

test.describe("identity/users — list", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
    // The role filter combobox loads the role list on mount.
    await mockJsonResponse(page, "**/api/v1/identity/roles", ROLES);
    // The pending invitations below the list; none unless a test says otherwise.
    await mockJsonResponse(page, "**/api/v1/identity/invitations", []);
  });

  test("renders the heading and a user row from the mock data", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged(USERS));

    await page.goto("/identity/users");

    await expect(
      page.getByRole("heading", { name: "Users", level: 1 }),
    ).toBeVisible();

    // Both a hidden mobile card AND a desktop row carry "Bob Patel". The
    // mobile card is rendered first in the DOM, the desktop row last — so the
    // last occurrence is the visible (md+) one at the default viewport.
    await expect(page.getByText("Bob Patel").last()).toBeVisible();
    await expect(page.getByText("bob@acme.com").last()).toBeVisible();
  });

  test("shows the empty state when the search returns no users", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged([]));

    await page.goto("/identity/users");

    // No search/filter active → "No users yet" empty headline.
    await expect(
      page.getByRole("heading", { name: "No users yet", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText(/invite the first member to this tenant/i),
    ).toBeVisible();
  });

  test("typing in search re-queries and renders the matching user", async ({ page }) => {
    // Default: full list. After a "bob" search, return only Bob.
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged(USERS));

    await page.goto("/identity/users");
    await expect(page.getByText("Carol Smith").last()).toBeVisible();

    // Now narrow the mock to just Bob and type — the debounced query refires.
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged([USERS[0]]));
    await page.getByPlaceholder("Search by name, username, or email…").fill("bob");

    await expect(page.getByText("Bob Patel").last()).toBeVisible();
    await expect(page.getByText("Carol Smith")).toHaveCount(0);
  });

  test("invites an address: the dialog posts the e-mail and names, and sets no password", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged(USERS));
    const invited: unknown[] = [];
    await page.route("**/api/v1/identity/invitations", async (route) => {
      if (route.request().method() === "POST") {
        invited.push(route.request().postDataJSON());
        await route.fulfill({ status: 202, contentType: "application/json", body: "{}" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/identity/users");
    await page.getByRole("button", { name: /invite user/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /invite a member/i })).toBeVisible();
    // Users are global: the owner chooses the password when accepting.
    await expect(dialog.getByLabel("Password")).toHaveCount(0);
    await expect(dialog.getByLabel("Username")).toHaveCount(0);

    await dialog.getByLabel("Email").fill("dana@acme.com");
    await dialog.getByLabel("First name").fill("Dana");
    await dialog.getByRole("button", { name: /send invitation/i }).click();

    await expect(dialog).toBeHidden();
    expect(invited).toEqual([{ email: "dana@acme.com", firstName: "Dana" }]);
  });

  test("lists pending invitations and revokes one", async ({ page }) => {
    await mockJsonResponse(page, "**/api/v1/identity/users/search**", paged(USERS));
    await mockJsonResponse(page, "**/api/v1/identity/invitations", [
      {
        id: "33333333-3333-3333-3333-333333333333",
        email: "erin@acme.com",
        status: "Pending",
        createdOnUtc: "2026-11-20T10:00:00Z",
        expiresOnUtc: "2026-11-27T10:00:00Z",
      },
      {
        id: "44444444-4444-4444-4444-444444444444",
        email: "frank@acme.com",
        status: "Accepted",
        createdOnUtc: "2026-11-19T10:00:00Z",
        expiresOnUtc: "2026-11-26T10:00:00Z",
        acceptedOnUtc: "2026-11-20T09:00:00Z",
      },
    ]);
    const revoke = page.waitForRequest(
      (r) => r.url().endsWith("/api/v1/identity/invitations/33333333-3333-3333-3333-333333333333") && r.method() === "DELETE",
    );
    await page.route("**/api/v1/identity/invitations/*", (route) => route.fulfill({ status: 204 }));

    await page.goto("/identity/users");

    const pending = page.getByRole("region", { name: /pending invitations/i });
    await expect(pending.getByText("erin@acme.com")).toBeVisible();
    // An accepted invitation is a member now, in the list above.
    await expect(pending.getByText("frank@acme.com")).toHaveCount(0);

    await pending.getByRole("button", { name: /revoke the invitation of erin@acme\.com/i }).click();
    await revoke;
  });
});

test.describe("identity/users/:userId — detail", () => {
  const USER = USERS[0];
  const USER_ID = USER.id;

  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
    await mockJsonResponse(page, `**/api/v1/identity/users/${USER_ID}/roles`, [
      {
        roleId: ROLES[0].id,
        roleName: "Admin",
        description: "Full access",
        enabled: true,
      },
      {
        roleId: ROLES[1].id,
        roleName: "Manager",
        description: "Manage users",
        enabled: false,
      },
    ]);
    // Sessions are gated behind a permission TEST_USER lacks, but mock anyway.
    await mockJsonResponse(page, `**/api/v1/identity/users/${USER_ID}/sessions`, []);
    // Most specific last: the by-id GET. (Roles/sessions globs are more
    // specific paths so they still win for their URLs.)
    await mockJsonResponse(page, `**/api/v1/identity/users/${USER_ID}`, USER);
  });

  test("loads the user and shows the back link + role assignment", async ({ page }) => {
    await page.goto(`/identity/users/${USER_ID}`);

    await expect(
      page.getByRole("heading", { name: "Bob Patel", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to users/i }),
    ).toBeVisible();

    // The roles section lists the staged role toggles from the mock.
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();
    await expect(page.getByText("Manager", { exact: true })).toBeVisible();
  });

  test("renders the identity card fields from the mock", async ({ page }) => {
    await page.goto(`/identity/users/${USER_ID}`);

    await expect(
      page.getByRole("heading", { name: /identity card/i }),
    ).toBeVisible();
    // Email appears in the identity card profile row.
    await expect(page.getByText("bob@acme.com").first()).toBeVisible();
    // @username subtitle is shown in the hero.
    await expect(page.getByText("@bob").first()).toBeVisible();
  });
});
