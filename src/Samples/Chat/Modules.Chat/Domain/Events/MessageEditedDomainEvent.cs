using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Chat.Domain.Events;

public sealed record MessageEditedDomainEvent(
    Guid ChannelId,
    Guid MessageId,
    string AuthorUserId,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
