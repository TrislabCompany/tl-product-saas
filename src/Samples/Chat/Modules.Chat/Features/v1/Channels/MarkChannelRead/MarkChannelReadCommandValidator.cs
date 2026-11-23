using FluentValidation;
using Trislab.Modules.Chat.Contracts.v1.Commands;

namespace Trislab.Modules.Chat.Features.v1.Channels.MarkChannelRead;

public sealed class MarkChannelReadCommandValidator : AbstractValidator<MarkChannelReadCommand>
{
    public MarkChannelReadCommandValidator()
    {
        RuleFor(x => x.ChannelId).NotEmpty();
        RuleFor(x => x.MessageId).NotEmpty();
    }
}
