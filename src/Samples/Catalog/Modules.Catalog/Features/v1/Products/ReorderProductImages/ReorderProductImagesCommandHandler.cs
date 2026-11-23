using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.v1.Products.ReorderProductImages;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Products.ReorderProductImages;

public sealed class ReorderProductImagesCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<ReorderProductImagesCommand, Unit>
{
    public async ValueTask<Unit> Handle(ReorderProductImagesCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await dbContext.Products
            .FirstOrDefaultAsync(p => p.Id == command.ProductId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Product {command.ProductId} not found.")
                .Localized<CatalogResources>("Catalog.ProductNotFound", command.ProductId);

        product.ReorderImages(command.OrderedImageIds);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
