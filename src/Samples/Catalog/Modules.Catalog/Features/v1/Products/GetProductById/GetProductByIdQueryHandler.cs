using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.Dtos;
using Trislab.Modules.Catalog.Contracts.v1.Products;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Products.GetProductById;

public sealed class GetProductByIdQueryHandler(CatalogDbContext dbContext)
    : IQueryHandler<GetProductByIdQuery, ProductDto>
{
    public async ValueTask<ProductDto> Handle(GetProductByIdQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var product = await dbContext.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == query.ProductId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Product {query.ProductId} not found.")
                .Localized<CatalogResources>("Catalog.ProductNotFound", query.ProductId);

        return product.ToDto();
    }
}
