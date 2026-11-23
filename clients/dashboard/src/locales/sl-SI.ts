// Every sl-SI catalog in one module, so the language ships as a single lazy chunk that
// loadLanguage (src/i18n.ts) fetches on demand. Keyed by namespace (the file name); a namespace
// without a file here renders in English through the fallback chain.
const files = import.meta.glob<Record<string, string>>("./sl-SI/*.json", {
  eager: true,
  import: "default",
});

export default Object.fromEntries(
  Object.entries(files).map(([file, catalog]) => [file.slice("./sl-SI/".length, -".json".length), catalog]),
);
