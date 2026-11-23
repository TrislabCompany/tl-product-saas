using FluentValidation;
using Trislab.Modules.Chat.Contracts.v1.Commands;

namespace Trislab.Modules.Chat.Features.v1.Messages.DeleteMessage;

public sealed class DeleteMessageCommandValidator : AbstractValidator<DeleteMessageCommand>
{
    public DeleteMessageCommandValidator()
    {
        RuleFor(x => x.MessageId).NotEmpty();
    }
}
