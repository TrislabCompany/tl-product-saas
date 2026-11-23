using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Products;

public sealed record DeleteProductCommand(Guid ProductId) : ICommand<Unit>;
