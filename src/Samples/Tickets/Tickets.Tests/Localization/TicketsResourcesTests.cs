using System;
using System.Globalization;
using Trislab.Modules.Tickets.Contracts.Dtos;
using System.Linq;
using Trislab.Modules.Tickets.Localization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;

namespace Tickets.Tests.Localization;

// Proves the TicketsResources catalog is embedded under the correct manifest name so the module
// resx resolves at runtime. A wrong manifest name would flip ResourceNotFound and leak raw keys or
// English text, and a sl-SI key the neutral catalog lacks is an orphan of a rename or delete. Both are
// caught here; a missing sl-SI entry is allowed and falls back to English. This is the module's only
// unit test project, added when Tickets exception bodies were localized.
public sealed class TicketsResourcesTests
{
    private static IStringLocalizer BuildLocalizer()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddLocalization(o => o.ResourcesPath = "");
        return services.BuildServiceProvider()
            .GetRequiredService<IStringLocalizerFactory>()
            .Create(typeof(TicketsResources));
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
        var neutral = KeysFor(string.Empty);   // TicketsResources.resx (English / fallback)
        var sl = KeysFor("sl-SI");                 // TicketsResources.sl-SI.resx

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
            var en = localizer["Tickets.ClosedCannotResolve"];
            en.ResourceNotFound.ShouldBeFalse(
                "resx did not resolve 'Tickets.ClosedCannotResolve' for en-US — check ResourcesPath/resx manifest name.");
            en.Value.ShouldBe("A closed ticket cannot be resolved — reopen it first.");

            CultureInfo.CurrentUICulture = new CultureInfo("sl-SI");
            var sl = localizer["Tickets.ClosedCannotResolve"];
            sl.ResourceNotFound.ShouldBeFalse(
                "resx did not resolve 'Tickets.ClosedCannotResolve' for sl-SI — check the .sl-SI catalog manifest name.");
            sl.Value.ShouldBe("Zaprtega zahtevka ni mogoče rešiti – najprej ga znova odprite.");

            sl.Value.ShouldNotBe(en.Value);
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }

    // TicketNotFound carries the ticket id ({0}); OnlyResolvedCanClose carries the status ({0}).
    [Fact]
    public void Parameterized_keys_format_args_in_both_cultures()
    {
        var localizer = BuildLocalizer();
        var previous = CultureInfo.CurrentUICulture;
        try
        {
            CultureInfo.CurrentUICulture = new CultureInfo("en-US");
            localizer["Tickets.TicketNotFound", "abc"].Value.ShouldBe("Ticket abc not found.");

            CultureInfo.CurrentUICulture = new CultureInfo("sl-SI");
            localizer["Tickets.TicketNotFound", "abc"].Value.ShouldBe("Zahtevek abc ni najden.");
            // The status argument arrives already localized: GlobalExceptionHandler resolves an enum
            // argument through this same catalog before formatting, so asserting the raw "Open" here
            // would pin a sentence no user ever sees.
            localizer["Tickets.OnlyResolvedCanClose", localizer["TicketStatus.Open"].Value].Value
                .ShouldBe("Zapreti je mogoče samo rešen zahtevek – trenutno stanje je Odprt. Najprej ga rešite.");
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }

    // An enum handed to a message as an argument is looked up as "{EnumType}.{Member}" by
    // GlobalExceptionHandler. A member with no entry falls back to its C# name, which is a code
    // identifier, not display text, so every member needs a neutral entry; sl-SI may omit it and fall back.
    [Theory]
    [InlineData(typeof(TicketStatus))]
    public void Every_enum_member_that_reaches_a_message_has_a_neutral_entry(Type enumType)
    {
        ArgumentNullException.ThrowIfNull(enumType);

        var neutral = KeysFor(string.Empty);

        foreach (var member in Enum.GetNames(enumType))
        {
            var key = $"{enumType.Name}.{member}";
            neutral.ShouldContain(key);
        }
    }
}
