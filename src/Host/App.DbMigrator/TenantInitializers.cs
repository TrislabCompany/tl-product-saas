using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Trislab.Framework.Persistence;
using Trislab.Framework.Shared.Multitenancy;
using Microsoft.Extensions.DependencyInjection;

namespace App.DbMigrator;

/// <summary>
/// Runs every registered module's <see cref="IDbInitializer"/> for one tenant: the same pass in both modes.
/// Multi-tenant mode calls it once per tenant of the catalog; single-tenant mode calls it once, for the fixed tenant.
/// A fresh scope per call, with the tenant context set first, because a module's DbContext captures the tenant
/// when it is built.
/// </summary>
internal static class TenantInitializers
{
    public static Task MigrateAsync(IServiceProvider services, AppTenantInfo tenant, CancellationToken cancellationToken) =>
        RunAsync(services, tenant, (init, ct) => init.MigrateAsync(ct), cancellationToken);

    public static Task SeedAsync(IServiceProvider services, AppTenantInfo tenant, CancellationToken cancellationToken) =>
        RunAsync(services, tenant, (init, ct) => init.SeedAsync(ct), cancellationToken);

    private static async Task RunAsync(
        IServiceProvider services,
        AppTenantInfo tenant,
        Func<IDbInitializer, CancellationToken, Task> step,
        CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();

        scope.ServiceProvider.GetRequiredService<IMultiTenantContextSetter>()
            .MultiTenantContext = new MultiTenantContext<AppTenantInfo>(tenant);

        foreach (var initializer in scope.ServiceProvider.GetServices<IDbInitializer>())
        {
            await step(initializer, cancellationToken).ConfigureAwait(false);
        }
    }
}
