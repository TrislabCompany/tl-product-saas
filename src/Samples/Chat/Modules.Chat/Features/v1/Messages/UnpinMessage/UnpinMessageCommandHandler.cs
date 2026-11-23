using Trislab.Framework.Core.Context;
using Trislab.Framework.Core.Exceptions;
using Trislab.Framework.Web.Realtime;
using Trislab.Modules.Chat.Contracts.v1.Commands;
using Trislab.Modules.Chat.Data;
using Trislab.Modules.Chat.Features.v1.Internal;
using Trislab.Modules.Chat.Localization;
using Mediator;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Chat.Features.v1.Messages.UnpinMessage;

public sealed class UnpinMessageCommandHandler(
    ChatDbContext db,
    ICurrentUser currentUser,
    IHubContext<AppHub> hub)
    : ICommandHandler<UnpinMessageCommand, Unit>
{
    public async ValueTask<Unit> Handle(UnpinMessageCommand cmd, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(cmd);
        var userId = currentUser.GetUserId();
        if (userId == Guid.Empty) throw new UnauthorizedException("no current user").Localized("Error.NoCurrentUser");
        var currentUserId = userId.ToString();

        var message = await db.Messages.FirstOrDefaultAsync(m => m.Id == cmd.MessageId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException("Message not found.").Localized<ChatResources>("Chat.MessageNotFound");

        var channel = await db.Channels.FirstOrDefaultAsync(c => c.Id == message.ChannelId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException("Message not found.").Localized<ChatResources>("Chat.MessageNotFound");
        channel.RequireMember(currentUserId);

        message.Unpin(currentUserId);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        await hub.Clients.Group($"channel:{channel.Id}")
            .SendAsync("ChatMessageUnpinned", message.ToDto(), cancellationToken)
            .ConfigureAwait(false);
        return Unit.Value;
    }
}
