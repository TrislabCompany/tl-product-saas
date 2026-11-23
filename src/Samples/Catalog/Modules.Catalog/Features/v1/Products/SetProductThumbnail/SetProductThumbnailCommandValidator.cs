using FluentValidation;
using Trislab.Modules.Catalog.Contracts.v1.Products.SetProductThumbnail;

namespace Trislab.Modules.Catalog.Features.v1.Products.SetProductThumbnail;

public sealed class SetProductThumbnailCommandValidator : AbstractValidator<SetProductThumbnailCommand>
{
    public SetProductThumbnailCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.ImageId).NotEmpty();
    }
}
