using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Trislab.Framework.Mailing.Services;
using Trislab.Modules.Identity.Data;

namespace Integration.Tests.Infrastructure;

/// <summary>
/// Creates users the way a product does: an administrator invites the address and its owner accepts the
/// e-mailed link with their own password. The test reads the link from the mail the host captured
/// (<see cref="NoOpMailService"/>); the e-mail is queued as a background job, so it is awaited.
/// </summary>
internal static partial class TestUsers
{
    public const string DefaultUserPassword = TestConstants.DefaultPassword;

    /// <summary>Invites a new address into the admin client's tenant and accepts it; the user can sign in.</summary>
    public static async Task<InvitedUser> InviteAndAcceptAsync(
        TrislabWebApplicationFactory factory,
        HttpClient adminClient,
        string prefix,
        string firstName = "Seeded",
        string lastName = "User",
        string password = DefaultUserPassword)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var email = $"{prefix}-{Guid.NewGuid().ToString("N")[..8]}@example.com";
        return await InviteAndAcceptAddressAsync(factory, adminClient, email, password, firstName, lastName);
    }

    /// <summary>Invites <paramref name="email"/> into the admin client's tenant and accepts with <paramref name="password"/>.</summary>
    public static async Task<InvitedUser> InviteAndAcceptAddressAsync(
        TrislabWebApplicationFactory factory,
        HttpClient adminClient,
        string email,
        string password,
        string firstName,
        string lastName)
    {
        ArgumentNullException.ThrowIfNull(factory);
        await InviteAsync(adminClient, email, firstName, lastName);
        var token = await WaitForInvitationTokenAsync(factory, email);

        using var anonymous = factory.CreateClient();
        using var accept = await anonymous.PostAsJsonAsync(
            $"{TestConstants.IdentityBasePath}/invitations/accept", new { token, password, firstName, lastName });
        accept.StatusCode.ShouldBe(HttpStatusCode.OK, await accept.Content.ReadAsStringAsync());

        var (userId, userName) = await FindUserAsync(factory, email);
        return new InvitedUser(userId, email, password, userName);
    }

    /// <summary>Sends an invitation into the admin client's tenant.</summary>
    public static async Task InviteAsync(HttpClient adminClient, string email, string? firstName = null, string? lastName = null)
    {
        ArgumentNullException.ThrowIfNull(adminClient);
        using var response = await adminClient.PostAsJsonAsync(
            $"{TestConstants.IdentityBasePath}/invitations", new { email, firstName, lastName });
        response.StatusCode.ShouldBe(HttpStatusCode.Accepted, await response.Content.ReadAsStringAsync());
    }

    /// <summary>Waits for the invitation e-mail to <paramref name="email"/> and returns its token.</summary>
    public static async Task<string> WaitForInvitationTokenAsync(TrislabWebApplicationFactory factory, string email)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var mail = (NoOpMailService)factory.Services.GetRequiredService<IMailService>();
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (DateTime.UtcNow < deadline)
        {
            var match = mail.Sent
                .Where(m => m.To.Contains(email, StringComparer.OrdinalIgnoreCase))
                .Select(m => TokenPattern().Match(m.Body ?? string.Empty))
                .LastOrDefault(m => m.Success);
            if (match is not null)
            {
                return Uri.UnescapeDataString(match.Groups[1].Value);
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"No invitation e-mail reached {email} within 30 seconds.");
    }

    /// <summary>The account id and user name of an address, read across tenants.</summary>
    public static async Task<(string Id, string UserName)> FindUserAsync(TrislabWebApplicationFactory factory, string email)
    {
        ArgumentNullException.ThrowIfNull(factory);
        ArgumentNullException.ThrowIfNull(email);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var normalized = email.ToUpperInvariant();
        var user = await db.Users.IgnoreQueryFilters()
            .Where(u => u.NormalizedEmail == normalized)
            .Select(u => new { u.Id, u.UserName })
            .SingleAsync();
        return (user.Id, user.UserName!);
    }

    [GeneratedRegex(@"accept-invitation\?token=([^&\s""<]+)")]
    private static partial Regex TokenPattern();
}

internal sealed record InvitedUser(string UserId, string Email, string Password, string UserName);
