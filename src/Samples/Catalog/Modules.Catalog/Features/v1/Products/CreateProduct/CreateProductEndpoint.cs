using Trislab.Modules.Catalog.Contracts.Authorization;
using Trislab.Framework.Shared.Identity.Authorization;
using Trislab.Framework.Web.Idempotency;
using Trislab.Modules.Catalog.Contracts.v1.Products;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Trislab.Modules.Catalog.Features.v1.Products.CreateProduct;

public static class CreateProductEndpoint
{
    internal static RouteHandlerBuilder MapCreateProductEndpoint(this IEndpointRouteBuilder endpoints)
    {
        return endpoints.MapPost("/products",
                async (CreateProductCommand command, IMediator mediator, CancellationToken ct) =>
                    Results.Ok(await mediator.Send(command, ct)))
            .WithName("CreateProduct")
            .WithSummary("Create a product")
            .RequirePermission(CatalogPermissions.Products.Create)
            .WithIdempotency();
    }
}
