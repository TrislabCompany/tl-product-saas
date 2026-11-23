import { createFrameworkI18n, SUPPORTED_LANGUAGES, type Catalog } from "@trislabcompany/framework-ui";
import enCommon from "@/locales/en-US/common.json";
import enAuth from "@/locales/en-US/auth.json";
import enNotifications from "@/locales/en-US/notifications.json";

// Canonical tags: specific (what the switcher offers, User.Locale persists, the claim carries).
// They come from framework-ui, which also holds the language rules the API follows (SupportedCultures.Tags).
export const SUPPORTED = SUPPORTED_LANGUAGES;

// en-US catalogs the app shell renders with. They ship in the main bundle so the first paint never
// waits on a catalog.
const eagerCatalogs = {
  common: enCommon,
  auth: enAuth,
  notifications: enNotifications,
} satisfies Record<string, Catalog>;

// en-US catalogs only route pages use. Each is its own small chunk, loaded by loadNamespaces() in
// parallel with the page's chunk (see `lazyNamed` in src/routes.tsx), so the page never renders
// before its text is there.
//
// To add a namespace: add its en-US JSON here (or to eagerCatalogs when the shell uses it) and list
// it on the routes that use it. The namespace list and the t() key types derive from these two
// maps. Its sl-SI file (optional) is picked up by src/locales/sl-SI.ts; a namespace or key sl-SI
// lacks renders in English through the fallback chain.
const lazyCatalogs = {
  settings: () => import("@/locales/en-US/settings.json"),
  identity: () => import("@/locales/en-US/identity.json"),
  overview: () => import("@/locales/en-US/overview.json"),
  subscription: () => import("@/locales/en-US/subscription.json"),
  activity: () => import("@/locales/en-US/activity.json"),
  catalog: () => import("@/locales/en-US/catalog.json"), // [module:Catalog]
  tickets: () => import("@/locales/en-US/tickets.json"), // [module:Tickets]
  files: () => import("@/locales/en-US/files.json"),
  audits: () => import("@/locales/en-US/audits.json"),
  commandPalette: () => import("@/locales/en-US/commandPalette.json"),
  system: () => import("@/locales/en-US/system.json"),
  chat: () => import("@/locales/en-US/chat.json"), // [module:Chat]
  health: () => import("@/locales/en-US/health.json"),
} satisfies Record<string, () => Promise<{ default: Catalog }>>;

export type LazyNamespace = keyof typeof lazyCatalogs;

// What src/i18next.d.ts checks every t() key against: the eager and lazy catalogs together.
export type Catalogs = typeof eagerCatalogs & {
  [K in LazyNamespace]: Awaited<ReturnType<(typeof lazyCatalogs)[K]>>["default"];
};

// One i18next instance, set up by framework-ui as every Trislab app runs it: en-US the terminal
// fallback, sl-SI one lazy chunk loaded before the switch, the choice kept in localStorage under
// this app's own key, `?culture=` honoured, and the document's `lang` kept in step.
const framework = createFrameworkI18n<LazyNamespace>({
  storageKey: "tl.dashboard",
  eager: eagerCatalogs,
  lazy: lazyCatalogs,
  languages: { "sl-SI": () => import("@/locales/sl-SI") },
  onMissingKey: (key) => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing key: ${key}`);
    }
  },
});

export const NAMESPACES = framework.namespaces;

// Loads route namespaces into en-US, the terminal fallback.
export const { loadNamespaces } = framework;

// Every language switch goes through here so the catalog lands before the UI re-renders in it.
export const { changeLanguage } = framework;

// Called from main.tsx AFTER loadRuntimeConfig(), so the deployment's default language is the fallback
// the browser's or the saved choice does not override.
export const initI18n = (deploymentDefault: string) => framework.init(deploymentDefault);

export default framework.i18n;
