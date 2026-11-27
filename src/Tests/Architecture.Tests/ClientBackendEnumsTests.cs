using System.Text.RegularExpressions;
using Shouldly;
using Trislab.Modules.Identity.Contracts.v1.Impersonation;
using Trislab.Modules.SubscriptionsUsage.Contracts; // [module:SubscriptionsUsage]
using Trislab.Modules.Tickets.Contracts.Dtos; // [module:Tickets]
using Xunit;

namespace Architecture.Tests;

/// <summary>
/// The React apps build some catalog keys from an enum value the API sends, and their
/// <c>tests/i18n/status-keys.spec.ts</c> checks that every member has a label in both locales. The framework's enums
/// are in its packages, not in this repository, so each app keeps the member names in
/// <c>tests/i18n/backend-enums.ts</c>. This test keeps that list equal to the real enum, so a member added to the
/// backend fails here until the list, and then the labels, catch up.
/// </summary>
public class ClientBackendEnumsTests
{
    private static readonly string SolutionRoot = ModuleArchitectureTestsFixture.SolutionRoot;

    public static TheoryData<string, Type> Enums => new()
    {
        { "admin", typeof(ImpersonationGrantStatus) },
        { "admin", typeof(ImpersonationRequestStatus) },
        { "admin", typeof(InvoiceStatus) }, // [module:SubscriptionsUsage]
        { "admin", typeof(TopupRequestStatus) }, // [module:SubscriptionsUsage]
        { "dashboard", typeof(InvoiceStatus) }, // [module:SubscriptionsUsage]
        { "dashboard", typeof(TopupRequestStatus) }, // [module:SubscriptionsUsage]
        { "dashboard", typeof(TicketStatus) }, // [module:Tickets]
        { "dashboard", typeof(TicketPriority) }, // [module:Tickets]
    };

    [Theory]
    [MemberData(nameof(Enums))]
    public void TheAppsList_Should_HaveEveryMemberOfTheEnum(string app, Type enumType)
    {
        ArgumentNullException.ThrowIfNull(enumType);
        string relative =Path.Combine("clients", app, "tests", "i18n", "backend-enums.ts");
        string source = File.ReadAllText(Path.Combine(SolutionRoot, relative));
        string expected = $"{enumType.Name}: [{string.Join(", ", Enum.GetNames(enumType).Select(name => $"\"{name}\""))}],";

        var line = Regex.Match(source, $@"^\s*{enumType.Name}:\s*\[(?<members>[^\]]*)\]", RegexOptions.Multiline);
        line.Success.ShouldBeTrue($"{relative} has no {enumType.Name}. Add the line: {expected}");

        string[] listed = [.. Regex.Matches(line.Groups["members"].Value, "\"(\\w+)\"").Select(m => m.Groups[1].Value)];
        listed.ShouldBe(Enum.GetNames(enumType), $"{relative} is out of date. Set the line to: {expected}");
    }
}
