using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Chat.Domain.Events;

public sealed record MessageUnpinnedDomainEvent(
    Guid ChannelId,
    Guid MessageId,
    string UnpinnedByUserId,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
