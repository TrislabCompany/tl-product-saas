using FluentValidation;
using Trislab.Modules.Chat.Contracts.v1.Commands;

namespace Trislab.Modules.Chat.Features.v1.Channels.RestoreChannel;

public sealed class RestoreChannelCommandValidator : AbstractValidator<RestoreChannelCommand>
{
    public RestoreChannelCommandValidator()
    {
        RuleFor(x => x.ChannelId).NotEmpty();
    }
}
