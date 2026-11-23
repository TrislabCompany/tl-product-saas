using Trislab.Framework.Core.Domain;
using Trislab.Modules.Tickets.Contracts.Dtos;

namespace Trislab.Modules.Tickets.Domain.Events;

public sealed record TicketCreatedDomainEvent(
    Guid TicketId,
    string Number,
    string Title,
    TicketPriority Priority,
    Guid ReporterUserId,
    Guid? AssignedToUserId,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
