using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Catalog.Domain.Events;

public sealed record ProductCreatedDomainEvent(
    Guid ProductId,
    string Sku,
    string Name,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
