using Trislab.Framework.Core.Context;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Chat.Contracts.v1.Commands;
using Trislab.Modules.Chat.Data;
using Trislab.Modules.Chat.Features.v1.Internal;
using Trislab.Modules.Chat.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Chat.Features.v1.Channels.ArchiveChannel;

public sealed class ArchiveChannelCommandHandler(
    ChatDbContext db,
    ICurrentUser currentUser)
    : ICommandHandler<ArchiveChannelCommand, Unit>
{
    public async ValueTask<Unit> Handle(ArchiveChannelCommand cmd, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(cmd);
        var userId = currentUser.GetUserId();
        if (userId == Guid.Empty) throw new UnauthorizedException("no current user").Localized("Error.NoCurrentUser");

        var channel = await db.Channels.FirstOrDefaultAsync(c => c.Id == cmd.ChannelId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException("Channel not found.").Localized<ChatResources>("Chat.ChannelNotFound");

        channel.RequireAdmin(userId.ToString());

        // Explicit soft-delete (not db.Remove): removing the aggregate cascades Deleted onto
        // the ChannelMember rows, which the audit interceptor does not rescue (they're FK
        // children, not owned), so they'd be hard-deleted and lost on restore.
        channel.Archive(userId.ToString());
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
