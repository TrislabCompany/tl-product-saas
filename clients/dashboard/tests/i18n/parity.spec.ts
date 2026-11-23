import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// en-US is the source catalog, and every text ships in sl-SI too: a key sl-SI
// lacks fails here (and in Architecture.Tests' FrontEndCatalogParityTests, which
// runs in ci), although at runtime it would render in English
// (fallback-chain.spec.ts). Also failing: a sl-SI key nothing renders (an orphan,
// usually a renamed or deleted en-US key) and a translation whose placeholders drift.
const localeDir = (locale: string) =>
  fileURLToPath(new URL(`../../src/locales/${locale}`, import.meta.url));

const load = (locale: string, ns: string): Record<string, string> =>
  JSON.parse(readFileSync(`${localeDir(locale)}/${ns}.json`, "utf8"));

// A contributor who adds a namespace without a translation ships no sl-SI file at all.
const loadTranslation = (ns: string): Record<string, string> => {
  try {
    return load("sl-SI", ns);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
};

const catalogFiles = (locale: string): string[] =>
  readdirSync(localeDir(locale))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();

// One entry per shipped namespace. Add new namespaces here as each wave lands.
const NAMESPACES = ["common", "auth", "settings", "identity", "overview", "subscription", "activity", "catalog", "tickets", "files", "audits", "commandPalette", "notifications", "system", "chat", "health"];

// Slovenian has four plural forms (_one, _two, _few, _other); English has two. A sl-SI plural
// form is not an orphan when en-US has the same key with _one or _other.
const isPluralForm = (key: string, en: Record<string, string>): boolean => {
  const match = /^(.+)_(one|two|few|other)$/.exec(key);
  return match !== null && (`${match[1]}_one` in en || `${match[1]}_other` in en);
};

test.describe("i18n catalog parity", () => {
  // The list above is hand-maintained, so it can drift from what actually ships: a namespace
  // file added without an entry here escapes every parity assertion below. This is the
  // completeness check that makes the hand-maintained list safe to keep.
  test("the namespace list covers every catalog file on disk", () => {
    expect(catalogFiles("en-US")).toEqual([...NAMESPACES].sort());
  });

  test("every sl-SI catalog file has an en-US counterpart", () => {
    expect(catalogFiles("sl-SI").filter((ns) => !NAMESPACES.includes(ns))).toEqual([]);
  });

  for (const ns of NAMESPACES) {
    test(`${ns}: sl-SI translates every en-US key`, () => {
      const sl = loadTranslation(ns);
      expect(Object.keys(load("en-US", ns)).filter((key) => !(key in sl))).toEqual([]);
    });
  }

  for (const ns of NAMESPACES) {
    test(`${ns}: sl-SI has no key en-US lacks`, () => {
      const en = load("en-US", ns);
      const orphans = Object.keys(loadTranslation(ns)).filter((key) => !(key in en) && !isPluralForm(key, en));
      expect(orphans).toEqual([]);
    });
  }

  // A translation that drops or renames an interpolation renders the placeholder
  // as literal text ("Olá, {{name}}") or silently loses the value, and neither
  // shows up as a missing key. i18next resolves `{{name}}` and `{{count, number}}`
  // alike, so the variable name is taken up to the first comma and the formatter
  // is ignored.
  const placeholders = (value: string): string[] =>
    [...value.matchAll(/{{\s*([^},]+?)\s*(?:,[^}]*)?}}/g)].map((m) => m[1]).sort();

  for (const ns of NAMESPACES) {
    test(`${ns}: en-US and sl-SI interpolate the same variables`, () => {
      const en = load("en-US", ns);
      const sl = loadTranslation(ns);
      const divergent = Object.keys(en)
        .filter((key) => typeof en[key] === "string" && typeof sl[key] === "string")
        .map((key) => ({
          key,
          en: placeholders(en[key]),
          sl: placeholders(sl[key]),
        }))
        .filter(({ en: a, sl: b }) => a.join("|") !== b.join("|"));

      expect(divergent).toEqual([]);
    });
  }
});
