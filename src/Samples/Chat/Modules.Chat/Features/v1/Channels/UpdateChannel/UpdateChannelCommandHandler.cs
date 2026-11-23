using Trislab.Framework.Core.Context;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Chat.Contracts.v1.Commands;
using Trislab.Modules.Chat.Data;
using Trislab.Modules.Chat.Features.v1.Internal;
using Trislab.Modules.Chat.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Chat.Features.v1.Channels.UpdateChannel;

public sealed class UpdateChannelCommandHandler(
    ChatDbContext db,
    ICurrentUser currentUser)
    : ICommandHandler<UpdateChannelCommand, Unit>
{
    public async ValueTask<Unit> Handle(UpdateChannelCommand cmd, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(cmd);
        var userId = currentUser.GetUserId();
        if (userId == Guid.Empty) throw new UnauthorizedException("no current user").Localized("Error.NoCurrentUser");

        var channel = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.ChannelId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException("Channel not found.").Localized<ChatResources>("Chat.ChannelNotFound");

        channel.RequireAdmin(userId.ToString());
        channel.Rename(cmd.Name, cmd.Description);
        channel.SetPrivate(cmd.IsPrivate);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
