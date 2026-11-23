using Trislab.Framework.Core.Domain;
using Trislab.Modules.Tickets.Contracts.Dtos;

namespace Trislab.Modules.Tickets.Domain.Events;

public sealed record TicketStatusChangedDomainEvent(
    Guid TicketId,
    TicketStatus PreviousStatus,
    TicketStatus NewStatus,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
