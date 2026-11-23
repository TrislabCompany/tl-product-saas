using Trislab.Framework.Core.Exceptions;
using Trislab.Framework.Persistence;
using Trislab.Modules.Catalog.Contracts.v1.Categories;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Categories.RestoreCategory;

public sealed class RestoreCategoryCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<RestoreCategoryCommand, Guid>
{
    public async ValueTask<Guid> Handle(RestoreCategoryCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var category = await dbContext.Categories
            .IgnoreQueryFilters([QueryFilters.SoftDelete])
            .FirstOrDefaultAsync(c => c.Id == command.CategoryId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Category {command.CategoryId} not found.")
                .Localized<CatalogResources>("Catalog.CategoryNotFound", command.CategoryId);

        category.Restore();
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return category.Id;
    }
}
