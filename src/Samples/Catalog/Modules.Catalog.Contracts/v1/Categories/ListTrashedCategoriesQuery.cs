using Trislab.Framework.Shared.Persistence;
using Trislab.Modules.Catalog.Contracts.Dtos;
using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Categories;

public sealed record ListTrashedCategoriesQuery(int PageNumber = 1, int PageSize = 20)
    : IQuery<PagedResponse<CategoryDto>>;
