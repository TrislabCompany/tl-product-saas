using System.Net;
using Trislab.Framework.Core.Exceptions;
using Trislab.Modules.Catalog.Contracts.v1.Brands;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Domain;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Brands.CreateBrand;

public sealed class CreateBrandCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<CreateBrandCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateBrandCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var brand = Brand.Create(command.Name, command.Description, command.LogoUrl);

        bool slugTaken = await dbContext.Brands
            .AnyAsync(b => b.Slug == brand.Slug, cancellationToken)
            .ConfigureAwait(false);
        if (slugTaken)
        {
            throw new CustomException(
                $"A brand with name '{command.Name}' already exists.",
                (IEnumerable<string>?)null,
                HttpStatusCode.Conflict)
                .Localized<CatalogResources>("Catalog.BrandNameAlreadyExists", command.Name);
        }

        dbContext.Brands.Add(brand);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return brand.Id;
    }
}
