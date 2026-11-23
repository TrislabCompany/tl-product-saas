using FluentValidation;
using Trislab.Modules.Catalog.Contracts.v1.Products.ReorderProductImages;

namespace Trislab.Modules.Catalog.Features.v1.Products.ReorderProductImages;

public sealed class ReorderProductImagesCommandValidator : AbstractValidator<ReorderProductImagesCommand>
{
    public ReorderProductImagesCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.OrderedImageIds).NotNull();
    }
}
