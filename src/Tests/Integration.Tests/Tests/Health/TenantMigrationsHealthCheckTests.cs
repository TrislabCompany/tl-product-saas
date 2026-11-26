using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Trislab.Framework.Shared.Multitenancy;
using Trislab.Modules.Multitenancy;
using Trislab.Modules.Multitenancy.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Testcontainers.PostgreSql;

namespace Integration.Tests.Tests.Health;

/// <summary>
/// Direct unit tests for <see cref="TenantMigrationsHealthCheck"/> — the production-readiness
/// gate added when API-side auto-migration was removed. Asserts that the check returns
/// <c>Unhealthy</c> against an unmigrated database and <c>Healthy</c> after the schema is
/// brought to head (the exact transition <c>App.DbMigrator</c> performs in production).
/// Uses a real Postgres testcontainer + an in-memory <see cref="IMultiTenantStore{TTenantInfo, TId}"/>
/// to keep the test independent of the shared <c>TrislabWebApplicationFactory</c> — avoiding
/// the global Hangfire state that would otherwise leak across test classes.
/// </summary>
public sealed class TenantMigrationsHealthCheckTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("tl_migrations_check")
        .WithUsername("postgres")
        .WithPassword("integration_test_pwd")
        .WithAutoRemove(true)
        .WithCleanUp(true)
        .Build();

    public async ValueTask InitializeAsync() => await _postgres.StartAsync();

    public ValueTask DisposeAsync() => _postgres.DisposeAsync();

    [Fact]
    public async Task CheckHealthAsync_Should_TransitionFromUnhealthyToHealthy_AsMigrationsApply()
    {
        await using var provider = BuildServiceProvider();
        var check = new TenantMigrationsHealthCheck(provider.GetRequiredService<IServiceScopeFactory>());
        var context = new HealthCheckContext
        {
            Registration = new HealthCheckRegistration("db:tenants-migrations", check, HealthStatus.Unhealthy, tags: null)
        };

        // ── Before migrations ────────────────────────────────────────────
        // Every migration is pending → check must be Unhealthy so /api/health/ready returns 503.
        var beforeResult = await check.CheckHealthAsync(context, CancellationToken.None);
        beforeResult.Status.ShouldBe(HealthStatus.Unhealthy);
        beforeResult.Description.ShouldNotBeNull();
        beforeResult.Description.ShouldContain("App.DbMigrator");

        // ── Apply migrations (what DbMigrator does in production) ────────
        using (var scope = provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TenantDbContext>();
            await db.Database.MigrateAsync();
        }

        // ── After migrations ─────────────────────────────────────────────
        var afterResult = await check.CheckHealthAsync(context, CancellationToken.None);
        afterResult.Status.ShouldBe(HealthStatus.Healthy);
    }

    [Fact]
    public async Task CheckHealthAsync_Should_ReturnUnhealthy_When_TenantProbeThrows()
    {
        // A connection-string pointed at a port nothing listens on simulates an
        // unreachable tenant DB. The per-tenant try/catch must convert that to an
        // Unhealthy aggregate result, not propagate the exception.
        await using var provider = BuildServiceProvider(badConnectionString: true);
        var check = new TenantMigrationsHealthCheck(provider.GetRequiredService<IServiceScopeFactory>());
        var context = new HealthCheckContext
        {
            Registration = new HealthCheckRegistration("db:tenants-migrations", check, HealthStatus.Unhealthy, tags: null)
        };

        var result = await check.CheckHealthAsync(context, CancellationToken.None);
        result.Status.ShouldBe(HealthStatus.Unhealthy);
        result.Description.ShouldNotBeNull();
        result.Description.ShouldContain("error probing tenant", Case.Insensitive);
    }

    private ServiceProvider BuildServiceProvider(bool badConnectionString = false)
    {
        var connectionString = badConnectionString
            // Reserved discard port — refuses connections immediately.
            ? "Host=127.0.0.1;Port=1;Database=does_not_exist;Username=postgres;Password=x;Timeout=2;Command Timeout=2"
            : _postgres.GetConnectionString();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IMultiTenantStore<AppTenantInfo, string>>(new SingleTenantStore());
        services.AddSingleton<ITenantContext<AppTenantInfo, string>>(new AmbientTenantContext<AppTenantInfo, string>());
        services.AddSingleton<ITenantAccessor, AmbientTenantAccessor>();
        services.AddDbContext<TenantDbContext>(opts =>
            opts.UseNpgsql(connectionString, b => b.MigrationsHistoryTable("__EFMigrationsHistory", TenantDbContext.Schema)));
        return services.BuildServiceProvider();
    }

    /// <summary>Minimal in-memory tenant store — returns one tenant for the test.</summary>
    private sealed class SingleTenantStore : IMultiTenantStore<AppTenantInfo, string>
    {
        private readonly AppTenantInfo _tenant = new(
            MultitenancyConstants.Root.Id,
            MultitenancyConstants.Root.Name,
            connectionString: string.Empty,
            MultitenancyConstants.Root.EmailAddress,
            issuer: MultitenancyConstants.Root.Issuer);

        public Task<bool> AddAsync(AppTenantInfo tenantInfo, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<bool> RemoveAsync(string id, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<bool> RemoveByIdentifierAsync(string identifier, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<bool> UpdateAsync(AppTenantInfo tenantInfo, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<AppTenantInfo?> GetByIdentifierAsync(string identifier, CancellationToken cancellationToken = default) => Task.FromResult<AppTenantInfo?>(_tenant);
        public Task<AppTenantInfo?> GetAsync(string id, CancellationToken cancellationToken = default) => Task.FromResult<AppTenantInfo?>(_tenant);
        public Task<IEnumerable<AppTenantInfo>> GetAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IEnumerable<AppTenantInfo>>([_tenant]);
        public Task<IEnumerable<AppTenantInfo>> GetAllAsync(int take, int skip, CancellationToken cancellationToken = default) => Task.FromResult<IEnumerable<AppTenantInfo>>([_tenant]);
    }

}
