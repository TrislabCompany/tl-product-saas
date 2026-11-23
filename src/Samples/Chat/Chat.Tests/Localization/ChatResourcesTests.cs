using System.Globalization;
using System.Linq;
using Trislab.Modules.Chat.Localization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;

namespace Chat.Tests.Localization;

// Proves the ChatResources catalog is embedded under the correct manifest name (ResourcesPath="" =>
// co-located marker + resx). A wrong manifest name flips ResourceNotFound and leaks raw keys; a
// sl-SI key the neutral catalog lacks is an orphan of a rename or delete. Both are caught here.
// A missing sl-SI entry is allowed: it falls back to English.
public sealed class ChatResourcesTests
{
    private static IStringLocalizer BuildLocalizer()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddLocalization(o => o.ResourcesPath = "");
        return services.BuildServiceProvider()
            .GetRequiredService<IStringLocalizerFactory>()
            .Create(typeof(ChatResources));
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
        var neutral = KeysFor(string.Empty);   // ChatResources.resx (English / fallback)
        var sl = KeysFor("sl-SI");                 // ChatResources.sl-SI.resx

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
            var en = localizer["Chat.ChannelNotFound"];
            en.ResourceNotFound.ShouldBeFalse(
                "resx did not resolve 'Chat.ChannelNotFound' for en-US — check ResourcesPath/resx manifest name.");
            en.Value.ShouldBe("Channel not found.");

            CultureInfo.CurrentUICulture = new CultureInfo("sl-SI");
            var sl = localizer["Chat.ChannelNotFound"];
            sl.ResourceNotFound.ShouldBeFalse(
                "resx did not resolve 'Chat.ChannelNotFound' for sl-SI — check the .sl-SI catalog manifest name.");
            sl.Value.ShouldBe("Kanal ni najden.");

            sl.Value.ShouldNotBe(en.Value);
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }
}
