using Trislab.Modules.Catalog.Contracts.Dtos;
using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Products;

public sealed record GetProductByIdQuery(Guid ProductId) : IQuery<ProductDto>;
