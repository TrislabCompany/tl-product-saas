using System.Globalization;
using System.Net;
using Trislab.Framework.Core.Context;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Tickets.Contracts.v1.Tickets;
using Trislab.Modules.Tickets.Data;
using Trislab.Modules.Tickets.Domain;
using Trislab.Modules.Tickets.Localization;
using Mediator;
using Trislab.Framework.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Tickets.Features.v1.Tickets.CreateTicket;

public sealed class CreateTicketCommandHandler(
    TicketsDbContext dbContext,
    ICurrentUser currentUser)
    : ICommandHandler<CreateTicketCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateTicketCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var reporterId = currentUser.GetUserId();
        if (reporterId == Guid.Empty)
        {
            throw new CustomException(
                "Cannot create a ticket without an authenticated reporter.",
                (IEnumerable<string>?)null,
                HttpStatusCode.Unauthorized)
                .Localized<TicketsResources>("Tickets.ReporterRequired");
        }

        // Sequential, tenant-scoped ticket numbers (TK-1, …). Count ALL rows incl. soft-deleted so a
        // deleted number isn't reused; racing writers collide on the unique index (→ 409, retryable).
        long count = await dbContext.Tickets
            .IgnoreQueryFilters([QueryFilters.SoftDelete])
            .LongCountAsync(cancellationToken)
            .ConfigureAwait(false);
        string number = $"TK-{(count + 1).ToString(CultureInfo.InvariantCulture)}";

        var ticket = Ticket.Create(
            number: number,
            title: command.Title,
            description: command.Description,
            priority: command.Priority,
            reporterUserId: reporterId,
            assignedToUserId: command.AssignedToUserId);

        dbContext.Tickets.Add(ticket);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return ticket.Id;
    }
}
