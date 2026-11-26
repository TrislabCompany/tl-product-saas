using Integration.Tests.Infrastructure;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Trislab.Framework.Shared.Health;

namespace Integration.Tests.Tests.Health;

/// <summary>The endpoints the platform relies on: its probes, and the info the front ends' /api proxy reaches.</summary>
[Collection(TrislabCollectionDefinition.Name)]
public sealed class PlatformProbesTests
{
    private readonly TrislabWebApplicationFactory _factory;

    public PlatformProbesTests(TrislabWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/healthz")]
    [InlineData("/readyz")]
    public async Task Probe_Should_Return200_WithoutAuthentication(string path)
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync(path);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Readyz_Should_LeaveOut_The_DetailsOnly_Checks()
    {
        // A details-only check (storage) that fails must not take the API out of rotation: files fail,
        // the rest of the app works. A failing check without the tag still does.
        await using var detailsOnlyDown = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.AddHealthChecks().AddCheck("test-details-only", () => HealthCheckResult.Unhealthy(), tags: [HealthCheckTags.DetailsOnly])));
        using (var client = detailsOnlyDown.CreateClient())
        {
            (await client.GetAsync("/readyz")).StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await using var checkDown = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
            s.AddHealthChecks().AddCheck("test-required", () => HealthCheckResult.Unhealthy())));
        using (var client = checkDown.CreateClient())
        {
            (await client.GetAsync("/readyz")).StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        }
    }

    [Fact]
    public async Task Info_Should_Return_Name_And_Environment_WithoutAuthentication()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/health/info");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("\"name\":\"App.Api\"");
        body.ShouldContain("\"environment\":\"local\"");
    }
}
