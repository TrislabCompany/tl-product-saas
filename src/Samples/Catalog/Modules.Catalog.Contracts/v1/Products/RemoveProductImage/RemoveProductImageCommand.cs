using Mediator;

namespace Trislab.Modules.Catalog.Contracts.v1.Products.RemoveProductImage;

public sealed record RemoveProductImageCommand(Guid ProductId, Guid ImageId) : ICommand<Unit>;
