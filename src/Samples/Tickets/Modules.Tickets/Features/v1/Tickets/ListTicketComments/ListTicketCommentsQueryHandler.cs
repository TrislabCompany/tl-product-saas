using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Tickets.Contracts.Dtos;
using Trislab.Modules.Tickets.Localization;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Trislab.Modules.Tickets.Data;
using Trislab.Modules.Tickets.Domain;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.ListTicketComments;

public sealed class ListTicketCommentsQueryHandler(TicketsDbContext dbContext)
    : IQueryHandler<ListTicketCommentsQuery, IReadOnlyList<TicketCommentDto>>
{
    public async ValueTask<IReadOnlyList<TicketCommentDto>> Handle(
        ListTicketCommentsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        // 404 for a non-existent ticket rather than a misleading empty 200 — this also keeps the
        // endpoint from being used to probe which ticket ids exist.
        var ticketExists = await dbContext.Tickets
            .AsNoTracking()
            .AnyAsync(t => t.Id == query.TicketId, cancellationToken)
            .ConfigureAwait(false);
        if (!ticketExists)
        {
            throw new NotFoundException($"Ticket {query.TicketId} not found.")
                .Localized<TicketsResources>("Tickets.TicketNotFound", query.TicketId);
        }

        var comments = await dbContext.TicketComments
            .AsNoTracking()
            .Where(c => c.TicketId == query.TicketId)
            .OrderBy(c => c.CreatedAtUtc)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return comments.Select(c => c.ToDto()).ToList();
    }
}
