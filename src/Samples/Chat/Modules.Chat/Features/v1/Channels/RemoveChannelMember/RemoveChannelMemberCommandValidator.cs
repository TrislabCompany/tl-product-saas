using FluentValidation;
using Trislab.Modules.Chat.Contracts.v1.Commands;

namespace Trislab.Modules.Chat.Features.v1.Channels.RemoveChannelMember;

public sealed class RemoveChannelMemberCommandValidator : AbstractValidator<RemoveChannelMemberCommand>
{
    public RemoveChannelMemberCommandValidator()
    {
        RuleFor(x => x.ChannelId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty().MaximumLength(64);
    }
}
