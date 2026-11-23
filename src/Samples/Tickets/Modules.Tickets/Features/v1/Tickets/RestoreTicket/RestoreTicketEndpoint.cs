using Trislab.Framework.Shared.Identity.Authorization;
using Trislab.Framework.Web.Idempotency;
using Trislab.Modules.Tickets.Contracts.Authorization;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.RestoreTicket;

public static class RestoreTicketEndpoint
{
    internal static RouteHandlerBuilder MapRestoreTicketEndpoint(this IEndpointRouteBuilder endpoints)
    {
        return endpoints.MapPost("/tickets/{ticketId:guid}/restore",
                async (Guid ticketId, IMediator mediator, CancellationToken ct) =>
                    Results.Ok(await mediator.Send(new RestoreTicketCommand(ticketId), ct)))
            .WithName("RestoreTicket")
            .WithSummary("Restore a soft-deleted ticket")
            .RequirePermission(TicketsPermissions.Tickets.Restore)
            .WithIdempotency();
    }
}
