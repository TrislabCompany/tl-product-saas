using Trislab.Framework.Core.Domain;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.v1.Products;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Domain;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Products.ChangeProductPrice;

public sealed class ChangeProductPriceCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<ChangeProductPriceCommand, Guid>
{
    public async ValueTask<Guid> Handle(ChangeProductPriceCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var product = await dbContext.Products
            .FirstOrDefaultAsync(p => p.Id == command.ProductId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Product {command.ProductId} not found.")
                .Localized<CatalogResources>("Catalog.ProductNotFound", command.ProductId);

        product.ChangePrice(new Money(command.Amount, command.Currency));
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return product.Id;
    }
}
