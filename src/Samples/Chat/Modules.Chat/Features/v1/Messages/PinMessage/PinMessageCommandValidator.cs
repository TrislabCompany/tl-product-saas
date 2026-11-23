using FluentValidation;
using Trislab.Modules.Chat.Contracts.v1.Commands;

namespace Trislab.Modules.Chat.Features.v1.Messages.PinMessage;

public sealed class PinMessageCommandValidator : AbstractValidator<PinMessageCommand>
{
    public PinMessageCommandValidator()
    {
        RuleFor(x => x.MessageId).NotEmpty();
    }
}
