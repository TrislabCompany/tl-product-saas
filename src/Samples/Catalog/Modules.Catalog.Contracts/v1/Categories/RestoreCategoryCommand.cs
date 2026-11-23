using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Categories;

public sealed record RestoreCategoryCommand(Guid CategoryId) : ICommand<Guid>;
