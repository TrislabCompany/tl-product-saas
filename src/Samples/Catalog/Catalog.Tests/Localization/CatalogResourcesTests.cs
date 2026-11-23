using System.Globalization;
using System.Linq;
using Trislab.Modules.Catalog.Localization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;

namespace Catalog.Tests.Localization;

// Proves the CatalogResources catalog is embedded under the correct manifest name (ResourcesPath="" =>
// co-located marker + resx). A wrong manifest name flips ResourceNotFound and leaks raw keys; a
// sl-SI key the neutral catalog lacks is an orphan of a rename or delete. Both are caught here.
// A missing sl-SI entry is allowed: it falls back to English.
public sealed class CatalogResourcesTests
{
    private static IStringLocalizer BuildLocalizer()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddLocalization(o => o.ResourcesPath = "");
        return services.BuildServiceProvider()
            .GetRequiredService<IStringLocalizerFactory>()
            .Create(typeof(CatalogResources));
    }

    private static List<string> KeysFor(string culture)
    {
        var localizer = BuildLocalizer();
        var previous = CultureInfo.CurrentUICulture;
        try
        {
            CultureInfo.CurrentUICulture = culture.Length == 0
                ? CultureInfo.InvariantCulture
                : new CultureInfo(culture);
            return localizer.GetAllStrings(includeParentCultures: false)
                .Select(s => s.Name)
                .ToList();
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }

    [Fact]
    public void Every_slSI_key_exists_in_the_neutral_catalog()
    {
        var neutral = KeysFor(string.Empty);   // CatalogResources.resx (English / fallback)
        var sl = KeysFor("sl-SI");                 // CatalogResources.sl-SI.resx

        neutral.ShouldNotBeEmpty();
        sl.Except(neutral, StringComparer.Ordinal)
            .OrderBy(k => k, StringComparer.Ordinal)
            .ShouldBeEmpty();
    }

    [Fact]
    public void Known_key_resolves_and_differs_between_en_and_pt()
    {
        var localizer = BuildLocalizer();
        var previous = CultureInfo.CurrentUICulture;
        try
        {
            CultureInfo.CurrentUICulture = new CultureInfo("en-US");
            var en = localizer["Catalog.CategoryCannotBeOwnParent"];
            en.ResourceNotFound.ShouldBeFalse(
                "resx did not resolve 'Catalog.CategoryCannotBeOwnParent' for en-US — check ResourcesPath/resx manifest name.");
            en.Value.ShouldBe("A category cannot be its own parent.");

            CultureInfo.CurrentUICulture = new CultureInfo("sl-SI");
            var sl = localizer["Catalog.CategoryCannotBeOwnParent"];
            sl.ResourceNotFound.ShouldBeFalse(
                "resx did not resolve 'Catalog.CategoryCannotBeOwnParent' for sl-SI — check the .sl-SI catalog manifest name.");
            sl.Value.ShouldBe("Kategorija ne more biti sama sebi nadrejena.");

            sl.Value.ShouldNotBe(en.Value);
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }

    // The AdjustStock domain overflow message is localized with two positional args ({0}=delta, {1}=current stock).
    [Fact]
    public void StockAdjustmentNegative_formats_args_in_both_cultures()
    {
        var localizer = BuildLocalizer();
        var previous = CultureInfo.CurrentUICulture;
        try
        {
            CultureInfo.CurrentUICulture = new CultureInfo("en-US");
            var en = localizer["Catalog.StockAdjustmentNegative", -4, 3];
            en.ResourceNotFound.ShouldBeFalse();
            en.Value.ShouldBe("Stock adjustment of -4 would result in negative stock (current: 3).");

            CultureInfo.CurrentUICulture = new CultureInfo("sl-SI");
            var sl = localizer["Catalog.StockAdjustmentNegative", -4, 3];
            sl.ResourceNotFound.ShouldBeFalse();
            sl.Value.ShouldBe("Prilagoditev zaloge za -4 bi povzročila negativno zalogo (trenutno: 3).");
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }
}
