using Trislab.Framework.Core.Exceptions;
using Trislab.Framework.Persistence;
using Trislab.Modules.Catalog.Contracts.v1.Brands;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Catalog.Localization;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace Trislab.Modules.Catalog.Features.v1.Brands.RestoreBrand;

public sealed class RestoreBrandCommandHandler(CatalogDbContext dbContext)
    : ICommandHandler<RestoreBrandCommand, Guid>
{
    public async ValueTask<Guid> Handle(RestoreBrandCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        // Disable only the SoftDelete filter so we can load a deleted row;
        // tenant scoping stays in force, so cross-tenant restores cannot leak.
        var brand = await dbContext.Brands
            .IgnoreQueryFilters([QueryFilters.SoftDelete])
            .FirstOrDefaultAsync(b => b.Id == command.BrandId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new NotFoundException($"Brand {command.BrandId} not found.")
                .Localized<CatalogResources>("Catalog.BrandNotFound", command.BrandId);

        brand.Restore();
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return brand.Id;
    }
}
