using Trislab.Framework.Core.Context;
using Trislab.Framework.Core.Exceptions;
using Trislab.Framework.Web.Realtime;
using Trislab.Modules.Chat.Contracts.v1.Commands;
using Trislab.Modules.Chat.Data;
using Trislab.Modules.Chat.Domain;
using Trislab.Modules.Chat.Features.v1.Internal;
using Trislab.Modules.Chat.Localization;
using Mediator;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Chat.Features.v1.Channels.RemoveChannelMember;

public sealed class RemoveChannelMemberCommandHandler(
    ChatDbContext db,
    ICurrentUser currentUser,
    IHubContext<AppHub> hub)
    : ICommandHandler<RemoveChannelMemberCommand, Unit>
{
    public async ValueTask<Unit> Handle(RemoveChannelMemberCommand cmd, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(cmd);
        var userId = currentUser.GetUserId();
        if (userId == Guid.Empty) throw new UnauthorizedException("no current user").Localized("Error.NoCurrentUser");
        var currentUserId = userId.ToString();

        var channel = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.ChannelId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException("Channel not found.").Localized<ChatResources>("Chat.ChannelNotFound");

        // Self-leave is always allowed for the current user. Removing someone else requires Admin.
        var isSelfLeave = string.Equals(cmd.UserId, currentUserId, StringComparison.Ordinal);
        if (!isSelfLeave)
        {
            channel.RequireAdmin(currentUserId);
        }
        else
        {
            channel.RequireMember(currentUserId);
        }

        channel.RemoveMember(cmd.UserId, currentUserId);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        await hub.Clients.Group($"channel:{channel.Id}")
            .SendAsync("ChatChannelMemberRemoved", new { channelId = channel.Id, userId = cmd.UserId }, cancellationToken)
            .ConfigureAwait(false);
        await hub.Clients.Group($"user:{cmd.UserId}")
            .SendAsync("ChatChannelRemoved", new { channelId = channel.Id }, cancellationToken)
            .ConfigureAwait(false);
        return Unit.Value;
    }
}
