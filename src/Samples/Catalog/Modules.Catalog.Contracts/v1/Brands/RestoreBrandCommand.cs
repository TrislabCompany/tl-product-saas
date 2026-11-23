using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Brands;

public sealed record RestoreBrandCommand(Guid BrandId) : ICommand<Guid>;
