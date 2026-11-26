using Trislab.Modules.Auditing;
using Microsoft.Extensions.Hosting;

namespace Integration.Tests.Infrastructure;

/// <summary>
/// The static <c>Audit</c> publisher is process-wide rather than per host: <see cref="AuditingConfigurator"/> sets it
/// on start. A derived host built with <c>WithWebHostBuilder</c> points it at its own audit channel, and when it is
/// disposed it is left pointing at a channel nobody reads, so request audits are silently lost. When any host from
/// <see cref="TrislabWebApplicationFactory"/> stops, this points it back at the shared host. (Hangfire needs no such
/// restore: each host resolves its own storage, activator and filters from DI.)
/// </summary>
internal sealed class PrimaryHostStaticsRestorer : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (TrislabWebApplicationFactory.PrimaryAuditingConfigurator is { } configurator)
        {
            await configurator.StartAsync(cancellationToken);
        }
    }
}
