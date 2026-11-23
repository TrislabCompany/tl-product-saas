using Trislab.Framework.Shared.Multitenancy;
using Asp.Versioning;
using Trislab.Framework.Persistence;
using Trislab.Framework.Shared.Constants;
using Trislab.Framework.Web.Modules;
using Trislab.Modules.Tickets.Contracts.Authorization;
using Trislab.Modules.Tickets.Data;
using Trislab.Modules.Tickets.Features.v1.Tickets.AddTicketComment;
using Trislab.Modules.Tickets.Features.v1.Tickets.AssignTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.CloseTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.CreateTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.DeleteTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.GetTicketById;
using Trislab.Modules.Tickets.Features.v1.Tickets.ListTicketComments;
using Trislab.Modules.Tickets.Features.v1.Tickets.ListTrashedTickets;
using Trislab.Modules.Tickets.Features.v1.Tickets.ReopenTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.ResolveTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.RestoreTicket;
using Trislab.Modules.Tickets.Features.v1.Tickets.SearchTickets;
using Trislab.Modules.Tickets.Features.v1.Tickets.UpdateTicket;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;

[assembly: TrislabModule(typeof(Trislab.Modules.Tickets.TicketsModule), 700)]

namespace Trislab.Modules.Tickets;

public sealed class TicketsModule : IModule
{
    /// <summary>Works with and without a tenant catalog; data is stamped with the tenant in both modes.</summary>
    public TenancyModes SupportedTenancyModes => TenancyModes.All;

    public void ConfigureServices(IHostApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        PermissionConstants.Register(TicketsPermissions.All);

        builder.Services.AddTrislabDbContext<TicketsDbContext>(TicketsDbContext.Schema);
        builder.Services.AddScoped<IDbInitializer, TicketsDbInitializer>();

        builder.Services.AddHealthChecks()
            .AddDbContextCheck<TicketsDbContext>(
                name: "db:tickets",
                failureStatus: HealthStatus.Unhealthy);
    }

    public void ConfigureMiddleware(IApplicationBuilder app)
    {
        // No custom middleware needed
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        var versionSet = endpoints.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1))
            .ReportApiVersions()
            .Build();

        var group = endpoints
            .MapGroup("api/v{version:apiVersion}")
            .WithTags("Tickets")
            .WithApiVersionSet(versionSet)
            .RequireAuthorization();

        // Trash + comment routes register before the catch-all `{ticketId:guid}` GET so literal
        // segments win — minimal APIs match the first compatible pattern, so order matters.
        group.MapListTrashedTicketsEndpoint();
        group.MapAddTicketCommentEndpoint();
        group.MapListTicketCommentsEndpoint();

        group.MapRestoreTicketEndpoint();
        group.MapAssignTicketEndpoint();
        group.MapResolveTicketEndpoint();
        group.MapReopenTicketEndpoint();
        group.MapCloseTicketEndpoint();

        group.MapCreateTicketEndpoint();
        group.MapSearchTicketsEndpoint();
        group.MapUpdateTicketEndpoint();
        group.MapDeleteTicketEndpoint();
        group.MapGetTicketByIdEndpoint();
    }
}
