using Microsoft.Extensions.Configuration;

namespace Integration.Tests.Tests.Health;

/// <summary>
/// Loads the shipped <c>appsettings</c> of <c>src/Host/App.Api</c> the way the host does and pins what a
/// deployment actually gets. An environment overlay cannot clear a JSON array (an empty <c>[]</c> writes no
/// indices), so a dev origin in the base file would survive into Production: the dev origins live in
/// <c>appsettings.Development.json</c> only. Needs no container.
/// </summary>
public sealed class ShippedConfigurationTests
{
    private static string HostDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "src", "Host", "App.Api");
            if (File.Exists(Path.Combine(candidate, "appsettings.json")))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new InvalidOperationException("Could not locate src/Host/App.Api from the test output directory.");
    }

    private static IConfigurationRoot LoadFor(string environment) =>
        new ConfigurationBuilder()
            .SetBasePath(HostDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: false)
            .Build();

    private static string[] ArrayOf(IConfiguration configuration, string section) =>
        configuration.GetSection(section).Get<string[]>() ?? [];

    [Fact]
    public void Production_Should_TrustNoLocalhostOrigin_When_TheShippedFilesAreLoadedInOrder()
    {
        var configuration = LoadFor("Production");

        ArrayOf(configuration, "FrontendOptions:AllowedOrigins").ShouldBeEmpty();
        ArrayOf(configuration, "CorsOptions:AllowedOrigins").ShouldBeEmpty();
        configuration["FrontendOptions:DefaultOrigin"].ShouldBeNullOrEmpty();
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public void Environments_Should_ShipAnEmptyRedisKeyPrefix(string environment)
    {
        // CachingOptions:KeyPrefix is opt-in. A shipped default would move the Data Protection key ring
        // of every existing deployment on upgrade, and the new ring is empty: auth cookies and reset
        // tokens stop validating. The migrator links only appsettings.json + .Development.json, so a
        // Production-only value would also give it a different prefix than the API.
        LoadFor(environment)["CachingOptions:KeyPrefix"].ShouldBeNullOrEmpty();
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public void Cors_Should_AllowPatchAndIfMatch_When_TheShippedFilesAreLoadedInOrder(string environment)
    {
        // `if-match` is not CORS-safelisted: with AllowAll = false the restricted policy strips it, and the
        // optimistic-concurrency precondition of a PUT/PATCH would silently never reach the endpoint.
        var configuration = LoadFor(environment);

        ArrayOf(configuration, "CorsOptions:AllowedMethods").ShouldContain("PATCH");
        ArrayOf(configuration, "CorsOptions:AllowedHeaders").ShouldContain("if-match");
    }
}
