using Trislab.Modules.Catalog.Contracts.Dtos;
using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Categories;

public sealed record GetCategoryByIdQuery(Guid CategoryId) : IQuery<CategoryDto>;
