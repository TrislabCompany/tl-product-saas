using System.Net;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.v1.Categories;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Domain;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Categories.CreateCategory;

public sealed class CreateCategoryCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<CreateCategoryCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateCategoryCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.ParentCategoryId is { } parentId)
        {
            bool parentExists = await dbContext.Categories
                .AnyAsync(c => c.Id == parentId, cancellationToken)
                .ConfigureAwait(false);
            if (!parentExists)
            {
                throw new NotFoundException($"Parent category {parentId} not found.")
                    .Localized<CatalogResources>("Catalog.ParentCategoryNotFound", parentId);
            }
        }

        var category = Category.Create(command.Name, command.Description, command.ParentCategoryId);

        bool slugTaken = await dbContext.Categories
            .AnyAsync(c => c.Slug == category.Slug, cancellationToken)
            .ConfigureAwait(false);
        if (slugTaken)
        {
            throw new CustomException(
                $"A category with name '{command.Name}' already exists.",
                (IEnumerable<string>?)null,
                HttpStatusCode.Conflict)
                .Localized<CatalogResources>("Catalog.CategoryNameAlreadyExists", command.Name);
        }

        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return category.Id;
    }
}
