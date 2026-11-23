using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Tickets.Contracts.Dtos;
using Trislab.Modules.Tickets.Localization;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Trislab.Modules.Tickets.Data;
using Trislab.Modules.Tickets.Domain;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.GetTicketById;

public sealed class GetTicketByIdQueryHandler(TicketsDbContext dbContext)
    : IQueryHandler<GetTicketByIdQuery, TicketDto>
{
    public async ValueTask<TicketDto> Handle(GetTicketByIdQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var ticket = await dbContext.Tickets
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == query.TicketId, cancellationToken)
            .ConfigureAwait(false);

        if (ticket is null)
        {
            throw new NotFoundException($"Ticket {query.TicketId} not found.")
                .Localized<TicketsResources>("Tickets.TicketNotFound", query.TicketId);
        }

        int commentCount = await dbContext.TicketComments
            .CountAsync(c => c.TicketId == ticket.Id, cancellationToken)
            .ConfigureAwait(false);

        return ticket.ToDto(commentCount);
    }
}
