using System.Reflection;
using Amazon.S3;
using Amazon.S3.Model;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Trislab.Framework.Jobs.Services;
using Trislab.Framework.Mailing;
using Trislab.Framework.Mailing.Services;
using Trislab.Framework.Persistence;
using Trislab.Framework.Shared.Multitenancy;
using Trislab.Framework.Tenancy;
using Microsoft.AspNetCore.WebUtilities;
using System.Text;
using Trislab.Modules.Multitenancy.Data;
using Trislab.Framework.Web.Modules;
using Trislab.Modules.Auditing;
using Hangfire;
using Hangfire.InMemory;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Testcontainers.PostgreSql;

namespace Integration.Tests.Infrastructure;

public class TrislabWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    internal const string S3AccessKey = "rustfsadmin";
    internal const string S3SecretKey = "rustfsadmin";
    internal const string S3Bucket = "tl-integration-test-uploads";

    /// <summary>The shared host's audit configurator; see <see cref="PrimaryHostStaticsRestorer"/>.</summary>
    internal static AuditingConfigurator? PrimaryAuditingConfigurator { get; private set; }

    private static readonly SemaphoreSlim _migrationLock = new(1, 1);

    // ModuleLoader keeps process-wide state that CreateHost resets, so two factories (one per tenancy mode)
    // never build their host at the same time.
    private static readonly object HostCreationLock = new();

    /// <summary>The tenant that tests sign in to: <c>root</c>.</summary>
#pragma warning disable CA1822, S2325 // instance members: the tests read them from the factory
    public string TenantId => TestConstants.RootTenantId;

    /// <summary>The e-mail of the seeded administrator of <see cref="TenantId"/>.</summary>
    public string AdminEmail => TestConstants.RootAdminEmail;
#pragma warning restore CA1822, S2325

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17.11-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b")
        .WithDatabase("tl_integration_tests")
        .WithUsername("postgres")
        .WithPassword("integration_test_pwd")
        .WithAutoRemove(true)
        .WithCleanUp(true)
        .Build();

    // The S3-compatible storage a stamp runs, pinned like docker-compose.yml's.
    private readonly IContainer _minio = new ContainerBuilder("rustfs/rustfs:1.0.3@sha256:9ca9559533b537d10482fe923288b676ad08f92a7069d9a17327fbae3cab688b")
        .WithEnvironment("RUSTFS_ACCESS_KEY", S3AccessKey)
        .WithEnvironment("RUSTFS_SECRET_KEY", S3SecretKey)
        .WithPortBinding(9000, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(9000))
        .WithAutoRemove(true)
        .WithCleanUp(true)
        .Build();

    public async ValueTask InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _minio.StartAsync());
        await CreateS3BucketAsync();

        // Force host creation via the Server property (no leaked HttpClient)
        _ = Server;
        PrimaryAuditingConfigurator = Services.GetServices<IHostedService>().OfType<AuditingConfigurator>().Single();

        // Migrate + seed the root tenant. The semaphore stops test classes sharing the DB
        // from migrating simultaneously.
        await _migrationLock.WaitAsync();
        try
        {
            await ProvisionRootTenantAsync();
        }
        finally
        {
            _migrationLock.Release();
        }
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        await _minio.DisposeAsync();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Removes tenants a test created from the shared tenant store. Use it for tenants that point at an
    /// unreachable database: later tests that walk every tenant (the legacy public-key migration job, for
    /// one) would otherwise count them as failures. Test order is not guaranteed, so clean up after yourself.
    /// </summary>
    public async Task RemoveTenantsAsync(IEnumerable<string> tenantIds)
    {
        ArgumentNullException.ThrowIfNull(tenantIds);
        using var scope = Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IMultiTenantStore<AppTenantInfo, string>>();
        foreach (var tenantId in tenantIds)
        {
            await store.RemoveAsync(tenantId);
        }
    }

    /// <summary>The MinIO endpoint URL exposed to the host configuration; useful for tests that need to PUT bytes directly.</summary>
    public string S3ServiceUrl => $"http://{_minio.Hostname}:{_minio.GetMappedPublicPort(9000)}";

    private async Task CreateS3BucketAsync()
    {
        var config = new AmazonS3Config
        {
            ServiceURL = S3ServiceUrl,
            ForcePathStyle = true,
            UseHttp = true,
            AuthenticationRegion = "us-east-1"
        };

        using var client = new AmazonS3Client(
            new Amazon.Runtime.BasicAWSCredentials(S3AccessKey, S3SecretKey),
            config);

        try
        {
            await client.PutBucketAsync(new PutBucketRequest { BucketName = S3Bucket });
        }
        catch (AmazonS3Exception ex) when (ex.ErrorCode == "BucketAlreadyOwnedByYou" || ex.ErrorCode == "BucketAlreadyExists")
        {
            // Idempotent across factory re-creations.
        }
    }

    // Browsers always send an Origin header on the cross-origin auth POSTs (forgot-password, register,
    // self-register). Simulate that globally so front-end-origin resolution matches the allow-list above.
    protected override void ConfigureClient(HttpClient client)
    {
        ArgumentNullException.ThrowIfNull(client);
        client.DefaultRequestHeaders.Add("Origin", "http://localhost");
        base.ConfigureClient(client);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.UseEnvironment("Development");

        // Read eagerly while Program.cs registers the host, before ConfigureAppConfiguration below applies, so
        // these go in as host settings, which are visible from the start.
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DatabaseOptions:Provider"] = "POSTGRESQL",
                ["DatabaseOptions:ConnectionString"] = _postgres.GetConnectionString(),
                ["CachingOptions:Redis"] = "",
                ["JwtOptions:Issuer"] = TestConstants.JwtIssuer,
                ["JwtOptions:Audience"] = TestConstants.JwtAudience,
                ["JwtOptions:SigningKey"] = TestConstants.JwtSigningKey,
                ["JwtOptions:AccessTokenMinutes"] = "30",
                ["JwtOptions:RefreshTokenDays"] = "7",
                ["OriginOptions:OriginUrl"] = "http://localhost",
                // Front-end origin resolution: allow the simulated browser Origin for self-service
                // flows, and set the same as the default so operator-driven flows (register/resend)
                // and the startup validation both resolve.
                ["FrontendOptions:AllowedOrigins:0"] = "http://localhost",
                ["FrontendOptions:DefaultOrigin"] = "http://localhost",
                ["OpenTelemetryOptions:Enabled"] = "false",
                ["EventingOptions:UseHostedServiceDispatcher"] = "false",
                ["Serilog:MinimumLevel:Default"] = "Warning",
                ["Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore"] = "Fatal",
                ["Serilog:MinimumLevel:Override:Npgsql"] = "Fatal",
                ["Serilog:WriteTo:0:Name"] = "Console",
                ["Serilog:WriteTo:0:Args:restrictedToMinimumLevel"] = "Warning",
                ["Serilog:WriteTo:1:Name"] = "",
                ["MailOptions:UseSendGrid"] = "false",
                ["HangfireOptions:Username"] = "admin",
                ["HangfireOptions:Password"] = "integration-test-hangfire-pwd",
                ["HangfireOptions:Route"] = "/jobs",
                ["RateLimitingOptions:Enabled"] = "false",
                ["PasswordPolicy:EnforcePasswordExpiry"] = "false",
                ["Seed:DemoPassword"] = "Password123!",
                ["Seed:DefaultAdminPassword"] = TestConstants.DefaultPassword,
                ["SecurityHeadersOptions:Enabled"] = "false",
                ["Storage:Provider"] = "s3",
                ["Storage:S3:Bucket"] = S3Bucket,
                ["Storage:S3:ServiceUrl"] = S3ServiceUrl,
                ["Storage:S3:AccessKey"] = S3AccessKey,
                ["Storage:S3:SecretKey"] = S3SecretKey,
                ["Storage:S3:ForcePathStyle"] = "true",
                ["Storage:S3:PublicRead"] = "false",
                ["Storage:S3:Region"] = "us-east-1",
            });
        });

        builder.ConfigureServices(services =>
        {
            // Stamp the connection IP from a test header so forwarded-headers trust checks are testable.
            services.AddSingleton<IStartupFilter, TestRemoteIpStartupFilter>();

            // The production TrustedProxyOptions read happens eagerly, before the test config overlay
            // applies (same quirk as storage below), so bind the trusted upstream here instead. Note what
            // that leaves these tests covering: overwriting the flags, the forward limit and both trust
            // lists wholesale replaces whatever the TrustedProxyOptions binding produced, so what runs
            // against TestConstants.TrustedProxyIp is the real middleware and the real placement of
            // UseForwardedHeaders, not the binding that feeds them in production. That binding is gated
            // separately, by Framework.Tests/Web/TrustedProxyOptionsBindingTests.
            services.PostConfigure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(forwarded =>
            {
                forwarded.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                    | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
                forwarded.ForwardLimit = 1;
                forwarded.KnownProxies.Clear();
                forwarded.KnownIPNetworks.Clear();
                forwarded.KnownProxies.Add(System.Net.IPAddress.Parse(TestConstants.TrustedProxyIp));
            });

            // Remove hosted services that need unavailable infra or race migrations (RolePermissionSync,
            // Hangfire server + stale-lock cleanup, OutboxDispatcher); we register our own InMemory server below.
            var hostedServicesToRemove = services
                .Where(d => d.ServiceType == typeof(IHostedService) &&
                    (d.ImplementationType?.Name == "RolePermissionSyncHostedService" ||
                     d.ImplementationType?.FullName?.Contains("Hangfire", StringComparison.Ordinal) == true ||
                     d.ImplementationType?.Name == "HangfireStaleLockCleanupService" ||
                     d.ImplementationType?.Name == "OutboxDispatcherHostedService"))
                .ToList();
            foreach (var service in hostedServicesToRemove)
            {
                services.Remove(service);
            }

            // Each host has its own job storage; the framework registers Hangfire per host, so a job runs on the
            // host that queued it.
            services.AddSingleton<JobStorage>(_ => new InMemoryStorage(new InMemoryStorageOptions()));
            services.AddHostedService<PrimaryHostStaticsRestorer>();
            services.AddHangfireServer(options =>
            {
                options.SchedulePollingInterval = TimeSpan.FromSeconds(1);
                options.Queues = ["default", "email"];
                options.WorkerCount = 2;
            });

            services.PostConfigure<JwtBearerOptions>(
                JwtBearerDefaults.AuthenticationScheme,
                options => options.RequireHttpsMetadata = false);

            // Replace real mail service with a no-op to avoid SMTP errors and Hangfire retries
            services.RemoveAll<IMailService>();
            services.AddSingleton<IMailService, NoOpMailService>();

            // A test-only endpoint that requires two permissions, for RequirePermissionAllOfTests.
            services.AddSingleton<IStartupFilter, TestPermissionEndpointStartupFilter>();

            // Detailed errors in tests instead of generic "An unexpected error occurred"
            var existingHandlers = services.Where(d =>
                d.ServiceType == typeof(Microsoft.AspNetCore.Diagnostics.IExceptionHandler)).ToList();
            foreach (var h in existingHandlers) services.Remove(h);
            services.AddExceptionHandler<DetailedTestExceptionHandler>();

            // AddTrislabStorage reads `Storage:Provider` eagerly (before the test config overlay applies), so it
            // wires LocalStorageService. Replace it here with the S3 stack pointed at the MinIO testcontainer.
            RewireStorageForS3(services);
        });
    }

    private void RewireStorageForS3(IServiceCollection services)
    {
        var toRemove = services
            .Where(d => d.ServiceType == typeof(Trislab.Framework.Storage.Services.IStorageService)
                     || d.ServiceType == typeof(Trislab.Framework.Storage.Local.LocalStorageService)
                     || d.ServiceType == typeof(Trislab.Framework.Storage.S3.S3StorageService)
                     || d.ServiceType == typeof(IAmazonS3))
            .ToList();
        foreach (var d in toRemove) services.Remove(d);

        services.Configure<Trislab.Framework.Storage.S3.S3StorageOptions>(opts =>
        {
            opts.Bucket = S3Bucket;
            opts.ServiceUrl = S3ServiceUrl;
            opts.AccessKey = S3AccessKey;
            opts.SecretKey = S3SecretKey;
            opts.ForcePathStyle = true;
            opts.PublicRead = false;
            opts.Region = "us-east-1";
        });

        services.AddSingleton<IAmazonS3>(_ => CreateRustFsClient());
        // S3StorageService presigns through a keyed client; tests reach RustFS on one address, so it matches.
        services.AddKeyedSingleton<IAmazonS3>(
            Trislab.Framework.Storage.S3.S3StorageService.PresignClientKey,
            (_, _) => CreateRustFsClient());
        services.AddTransient<Trislab.Framework.Storage.S3.S3StorageService>();
        services.AddTransient<Trislab.Framework.Storage.Services.IStorageService>(sp =>
            sp.GetRequiredService<Trislab.Framework.Storage.S3.S3StorageService>());
    }

    private AmazonS3Client CreateRustFsClient()
    {
        var config = new AmazonS3Config
        {
            ServiceURL = S3ServiceUrl,
            ForcePathStyle = true,
            UseHttp = true,
            AuthenticationRegion = "us-east-1"
        };
        return new AmazonS3Client(
            new Amazon.Runtime.BasicAWSCredentials(S3AccessKey, S3SecretKey),
            config);
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // Disable ValidateOnBuild for the minimal API dual-host model
        builder.UseServiceProviderFactory(new DefaultServiceProviderFactory(new ServiceProviderOptions
        {
            ValidateOnBuild = false,
            ValidateScopes = false
        }));

        lock (HostCreationLock)
        {
            ResetModuleLoader();
            return base.CreateHost(builder);
        }
    }

    private async Task ProvisionRootTenantAsync()
    {
        // 1. Explicitly migrate the tenant catalog FIRST.
        using (var scope = Services.CreateScope())
        {
            var tenantDbContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();
            await tenantDbContext.Database.MigrateAsync();

            // 2. Seed Root Tenant if missing (ensures we don't wait for background service)
            var rootTenant = await tenantDbContext.TenantInfo.FindAsync(MultitenancyConstants.Root.Id);
            if (rootTenant is null)
            {
                rootTenant = new AppTenantInfo(
                    MultitenancyConstants.Root.Id,
                    MultitenancyConstants.Root.Name,
                    string.Empty,
                    MultitenancyConstants.Root.EmailAddress,
                    issuer: MultitenancyConstants.Root.Issuer);

                var validUpto = DateTime.UtcNow.AddYears(1);
                rootTenant.SetValidity(validUpto);
                await tenantDbContext.TenantInfo.AddAsync(rootTenant);
                await tenantDbContext.SaveChangesAsync();
            }

            // 3. Run all module migrations (identity, audit, webhook schemas)
            using var tenantUse = scope.ServiceProvider.GetRequiredService<ITenantAccessor>().Use(rootTenant);

            foreach (var init in scope.ServiceProvider.GetServices<IDbInitializer>())
            {
                await init.MigrateAsync(CancellationToken.None);
            }

            // 4. Seed all modules (admin user, roles, permissions, groups)
            foreach (var init in scope.ServiceProvider.GetServices<IDbInitializer>())
            {
                await init.SeedAsync(CancellationToken.None);
            }

            // 5. Run the role-permission syncer through the production code path.
            var syncer = scope.ServiceProvider.GetRequiredService<Trislab.Modules.Identity.Authorization.RolePermissionSyncer>();
            await syncer.SyncAsync(CancellationToken.None);
        }
    }

    private static void ResetModuleLoader()
    {
        var type = typeof(ModuleLoader);
        var modulesField = type.GetField("_modules", BindingFlags.Static | BindingFlags.NonPublic);
        var loadedField = type.GetField("_modulesLoaded", BindingFlags.Static | BindingFlags.NonPublic);

        if (modulesField?.GetValue(null) is System.Collections.IList list)
        {
            list.Clear();
        }

        loadedField?.SetValue(null, false);
    }
}
