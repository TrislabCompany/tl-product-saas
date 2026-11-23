using Trislab.Framework.Shared.Identity.Authorization;
using Trislab.Framework.Web.Idempotency;
using Trislab.Modules.Tickets.Contracts.Authorization;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.AddTicketComment;

public static class AddTicketCommentEndpoint
{
    public sealed record AddTicketCommentRequest(string Body);

    internal static RouteHandlerBuilder MapAddTicketCommentEndpoint(this IEndpointRouteBuilder endpoints)
    {
        return endpoints.MapPost("/tickets/{ticketId:guid}/comments",
                async (Guid ticketId, AddTicketCommentRequest body, IMediator mediator, CancellationToken ct) =>
                    Results.Ok(await mediator.Send(new AddTicketCommentCommand(ticketId, body.Body), ct)))
            .WithName("AddTicketComment")
            .WithSummary("Add a comment to a ticket")
            .RequirePermission(TicketsPermissions.Tickets.Comment)
            .WithIdempotency();
    }
}
