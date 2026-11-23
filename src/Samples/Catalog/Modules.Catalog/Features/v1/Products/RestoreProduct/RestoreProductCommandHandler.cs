using Trislab.Framework.Core.Exceptions;
using Trislab.Framework.Persistence;
using Trislab.Modules.Catalog.Contracts.v1.Products;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Products.RestoreProduct;

public sealed class RestoreProductCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<RestoreProductCommand, Guid>
{
    public async ValueTask<Guid> Handle(RestoreProductCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await dbContext.Products
            .IgnoreQueryFilters([QueryFilters.SoftDelete])
            .FirstOrDefaultAsync(p => p.Id == command.ProductId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Product {command.ProductId} not found.")
                .Localized<CatalogResources>("Catalog.ProductNotFound", command.ProductId);

        product.Restore();
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return product.Id;
    }
}
