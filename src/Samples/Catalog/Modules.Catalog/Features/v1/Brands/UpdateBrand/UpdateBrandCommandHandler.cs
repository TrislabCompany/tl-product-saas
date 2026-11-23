using System.Net;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.v1.Brands;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Brands.UpdateBrand;

public sealed class UpdateBrandCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<UpdateBrandCommand, Guid>
{
    public async ValueTask<Guid> Handle(UpdateBrandCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var brand = await dbContext.Brands
            .FirstOrDefaultAsync(b => b.Id == command.BrandId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Brand {command.BrandId} not found.")
                .Localized<CatalogResources>("Catalog.BrandNotFound", command.BrandId);

        brand.Update(command.Name, command.Description, command.LogoUrl);

        bool slugTaken = await dbContext.Brands
            .AnyAsync(b => b.Slug == brand.Slug && b.Id != brand.Id, cancellationToken)
            .ConfigureAwait(false);
        if (slugTaken)
        {
            throw new CustomException(
                $"Another brand with name '{command.Name}' already exists.",
                (IEnumerable<string>?)null,
                HttpStatusCode.Conflict)
                .Localized<CatalogResources>("Catalog.AnotherBrandNameAlreadyExists", command.Name);
        }

        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return brand.Id;
    }
}
