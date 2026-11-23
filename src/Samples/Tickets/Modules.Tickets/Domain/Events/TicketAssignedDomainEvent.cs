using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Tickets.Domain.Events;

public sealed record TicketAssignedDomainEvent(
    Guid TicketId,
    Guid? PreviousAssigneeUserId,
    Guid? NewAssigneeUserId,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
