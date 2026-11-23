using Trislab.Framework.Shared.Identity.Authorization;
using Trislab.Framework.Web.Idempotency;
using Trislab.Modules.Tickets.Contracts.Authorization;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.CreateTicket;

public static class CreateTicketEndpoint
{
    internal static RouteHandlerBuilder MapCreateTicketEndpoint(this IEndpointRouteBuilder endpoints)
    {
        return endpoints.MapPost("/tickets",
                async (CreateTicketCommand command, IMediator mediator, CancellationToken ct) =>
                    Results.Ok(await mediator.Send(command, ct)))
            .WithName("CreateTicket")
            .WithSummary("Create a ticket")
            .RequirePermission(TicketsPermissions.Tickets.Create)
            .WithIdempotency();
    }
}
