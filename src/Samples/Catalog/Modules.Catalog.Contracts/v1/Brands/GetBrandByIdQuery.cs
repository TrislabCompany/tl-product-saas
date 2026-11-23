using Trislab.Modules.Catalog.Contracts.Dtos;
using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Brands;

public sealed record GetBrandByIdQuery(Guid BrandId) : IQuery<BrandDto>;
