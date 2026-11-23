using Trislab.Framework.Core.Exceptions;
using Trislab.Framework.Persistence;
using Trislab.Modules.Tickets.Localization;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Trislab.Modules.Tickets.Data;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.RestoreTicket;

public sealed class RestoreTicketCommandHandler(TicketsDbContext dbContext)
    : ICommandHandler<RestoreTicketCommand, Guid>
{
    public async ValueTask<Guid> Handle(RestoreTicketCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var ticket = await dbContext.Tickets
            .IgnoreQueryFilters([QueryFilters.SoftDelete])
            .FirstOrDefaultAsync(t => t.Id == command.TicketId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Ticket {command.TicketId} not found.")
                .Localized<TicketsResources>("Tickets.TicketNotFound", command.TicketId);

        ticket.Restore();
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return ticket.Id;
    }
}
