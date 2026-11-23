using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Chat.Contracts.v1.Commands;
using Trislab.Modules.Chat.Data;
using Trislab.Modules.Chat.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Chat.Features.v1.Channels.RestoreChannel;

public sealed class RestoreChannelCommandHandler(ChatDbContext db)
    : ICommandHandler<RestoreChannelCommand, Unit>
{
    public async ValueTask<Unit> Handle(RestoreChannelCommand cmd, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(cmd);

        // IgnoreQueryFilters bypasses the SoftDelete filter so we can find an archived channel.
        var channel = await db.Channels.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == cmd.ChannelId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException("Channel not found.").Localized<ChatResources>("Chat.ChannelNotFound");

        if (!channel.IsDeleted) return Unit.Value; // idempotent
        channel.Restore();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
