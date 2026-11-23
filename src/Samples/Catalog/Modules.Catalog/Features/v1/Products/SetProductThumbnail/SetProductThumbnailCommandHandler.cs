using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.v1.Products.SetProductThumbnail;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Products.SetProductThumbnail;

public sealed class SetProductThumbnailCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<SetProductThumbnailCommand, Unit>
{
    public async ValueTask<Unit> Handle(SetProductThumbnailCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await dbContext.Products
            .FirstOrDefaultAsync(p => p.Id == command.ProductId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Product {command.ProductId} not found.")
                .Localized<CatalogResources>("Catalog.ProductNotFound", command.ProductId);

        // Domain throws InvalidOperationException for unknown imageId; translate to a
        // framework-aware 404 so the API surfaces NotFound rather than a 500.
        if (!product.Images.Any(i => i.Id == command.ImageId))
        {
            throw new NotFoundException($"Image {command.ImageId} not found on product {command.ProductId}.")
                .Localized<CatalogResources>("Catalog.ProductImageNotFound", command.ImageId, command.ProductId);
        }

        product.SetThumbnail(command.ImageId);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
