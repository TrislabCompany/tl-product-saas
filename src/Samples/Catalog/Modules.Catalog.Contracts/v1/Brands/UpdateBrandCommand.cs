using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Brands;

public sealed record UpdateBrandCommand(
    Guid BrandId,
    string Name,
    string? Description = null,
    string? LogoUrl = null) : ICommand<Guid>;
