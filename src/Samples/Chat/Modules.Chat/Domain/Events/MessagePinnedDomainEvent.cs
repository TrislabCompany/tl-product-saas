using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Chat.Domain.Events;

public sealed record MessagePinnedDomainEvent(
    Guid ChannelId,
    Guid MessageId,
    string PinnedByUserId,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
