using Trislab.Framework.Core.Domain;

namespace Trislab.Modules.Chat.Domain.Events;

public sealed record ChannelMemberRemovedDomainEvent(
    Guid ChannelId,
    string RemovedUserId,
    string RemovedByUserId,
    Guid EventId,
    DateTimeOffset OccurredOnUtc) : DomainEvent(EventId, OccurredOnUtc);
