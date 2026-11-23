using System.Text.Json;
using Shouldly;
using Xunit;

namespace Architecture.Tests;

/// <summary>
/// Every text of the React apps ships in every supported language: each key of a
/// <c>clients/*/src/locales/en-US/*.json</c> catalog is in the same namespace's sl-SI catalog.
/// The apps' own <c>tests/i18n/parity.spec.ts</c> checks the same and more, but runs only with
/// Playwright; this runs in <c>ci / ci</c>. Slovenian has more plural forms than English, so a
/// sl-SI key only needs to exist for each en-US key, not the reverse.
/// </summary>
public class FrontEndCatalogParityTests
{
    private static readonly string SolutionRoot = ModuleArchitectureTestsFixture.SolutionRoot;

    private static readonly string[] TranslatedLanguages = ["sl-SI"];

    [Fact]
    public void Every_EnUs_Key_Has_A_Translation_In_Every_Supported_Language()
    {
        var apps = Directory.GetDirectories(Path.Combine(SolutionRoot, "clients"))
            .Where(app => Directory.Exists(Path.Combine(app, "src", "locales", "en-US")))
            .ToList();

        apps.ShouldNotBeEmpty("expected the React apps' catalogs under clients/*/src/locales/en-US");

        var violations = new List<string>();

        foreach (string app in apps)
        {
            string locales = Path.Combine(app, "src", "locales");

            foreach (string source in Directory.GetFiles(Path.Combine(locales, "en-US"), "*.json"))
            {
                string ns = Path.GetFileName(source);
                var english = Keys(source);

                foreach (string language in TranslatedLanguages)
                {
                    string translation = Path.Combine(locales, language, ns);
                    var translated = File.Exists(translation) ? Keys(translation) : [];
                    var missing = english.Where(key => !translated.Contains(key)).Order(StringComparer.Ordinal).ToList();

                    if (missing.Count > 0)
                    {
                        violations.Add($"{Path.GetRelativePath(SolutionRoot, translation)}: {missing.Count} key(s) not translated: {string.Join(", ", missing)}");
                    }
                }
            }
        }

        violations.ShouldBeEmpty(
            "Every text ships in every supported language. Add the missing keys to the sl-SI catalog. Violations:\n  " +
            string.Join("\n  ", violations));
    }

    private static HashSet<string> Keys(string file)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(file));
        var keys = new HashSet<string>(StringComparer.Ordinal);
        Collect(document.RootElement, prefix: null, keys);
        return keys;
    }

    private static void Collect(JsonElement element, string? prefix, HashSet<string> keys)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            keys.Add(prefix ?? string.Empty);
            return;
        }

        foreach (var property in element.EnumerateObject())
        {
            Collect(property.Value, prefix is null ? property.Name : $"{prefix}.{property.Name}", keys);
        }
    }
}
