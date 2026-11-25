import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { BACKEND_ENUMS } from "./backend-enums";
import { INVOICE_STATUS_KEYS, statusKey, TOPUP_STATUS_KEYS } from "../../src/lib/status-keys";

// Several labels build their catalog key from a value the API sends (`invoices.status.${status}`,
// the ticket status/priority maps in src/lib/ticket-enums.ts). Catalog parity cannot see those —
// both locales can be missing the same key and still match — so a value the backend emits and the
// catalog never learned about renders as the key itself.
//
// The member list comes from tests/i18n/backend-enums.ts, which Architecture.Tests keeps equal to the C#
// enum, so adding a member to the enum without translating it fails a test instead of reaching a screen.

function enumMembers(enumName: string): readonly string[] {
  const members = BACKEND_ENUMS[enumName];
  expect(members, `${enumName} is not in tests/i18n/backend-enums.ts`).toBeDefined();
  return members!;
}

const readCatalog = (locale: string, ns: string): Record<string, string> =>
  JSON.parse(
    readFileSync(path.resolve("src/locales", locale, `${ns}.json`), "utf8"),
  ) as Record<string, string>;

/** Looks a member up in the app's map (src/lib/status-keys.ts); a member it lacks has no key. */
const mapped = (keys: Record<string, string>) => (member: string) =>
  Object.hasOwn(keys, member) ? keys[member] : `(no entry for ${member} in src/lib/status-keys.ts)`;

const CASES = [
  {
    label: "invoices",
    ns: "subscription",
    enumName: "InvoiceStatus",
    key: mapped(INVOICE_STATUS_KEYS),
  },
  {
    label: "top-up requests",
    ns: "subscription",
    enumName: "TopupRequestStatus",
    key: mapped(TOPUP_STATUS_KEYS),
  },
  // [module:Tickets:begin]
  {
    label: "ticket status",
    ns: "tickets",
    enumName: "TicketStatus",
    key: (member: string) => `status.${member}`,
  },
  {
    label: "ticket priority",
    ns: "tickets",
    enumName: "TicketPriority",
    key: (member: string) => `priority.${member}`,
  },
  // [module:Tickets:end]
];

test("a status the server added after this build has no key, so the badge shows the raw value", () => {
  expect(statusKey(TOPUP_STATUS_KEYS, "Expired")).toBeUndefined();
  expect(statusKey(INVOICE_STATUS_KEYS, "constructor")).toBeUndefined();
  expect(statusKey(INVOICE_STATUS_KEYS, "Paid")).toBe("invoices.status.Paid");
});

test.describe("status keys built from backend enums", () => {
  for (const testCase of CASES) {
    test(`${testCase.label}: every member has a label in both locales`, () => {
      const members = enumMembers(testCase.enumName);
      const en = readCatalog("en-US", testCase.ns);
      const sl = readCatalog("sl-SI", testCase.ns);

      const missing = members
        .map((member) => testCase.key(member))
        .filter((key) => !(key in en) || !(key in sl));

      expect(missing).toEqual([]);
    });
  }
});
