using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Catalog.Domain.Events;

public sealed record ProductPriceChangedDomainEvent(
    Guid ProductId,
    decimal OldAmount,
    decimal NewAmount,
    string Currency,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
