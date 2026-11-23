using Trislab.Framework.Shared.Multitenancy;
using Asp.Versioning;
using Trislab.Framework.Eventing;
using Trislab.Framework.Persistence;
using Trislab.Framework.Shared.Constants;
using Trislab.Framework.Web.Modules;
using Trislab.Modules.Catalog.Authorization;
using Trislab.Modules.Catalog.Contracts.Authorization;
using Trislab.Modules.Catalog.Data;
using Trislab.Modules.Files.Contracts;
using Trislab.Modules.Catalog.Features.v1.Brands.CreateBrand;
using Trislab.Modules.Catalog.Features.v1.Brands.DeleteBrand;
using Trislab.Modules.Catalog.Features.v1.Brands.GetBrandById;
using Trislab.Modules.Catalog.Features.v1.Brands.ListTrashedBrands;
using Trislab.Modules.Catalog.Features.v1.Brands.RestoreBrand;
using Trislab.Modules.Catalog.Features.v1.Brands.SearchBrands;
using Trislab.Modules.Catalog.Features.v1.Brands.UpdateBrand;
using Trislab.Modules.Catalog.Features.v1.Categories.CreateCategory;
using Trislab.Modules.Catalog.Features.v1.Categories.DeleteCategory;
using Trislab.Modules.Catalog.Features.v1.Categories.GetCategoryById;
using Trislab.Modules.Catalog.Features.v1.Categories.GetCategoryTree;
using Trislab.Modules.Catalog.Features.v1.Categories.ListTrashedCategories;
using Trislab.Modules.Catalog.Features.v1.Categories.RestoreCategory;
using Trislab.Modules.Catalog.Features.v1.Categories.SearchCategories;
using Trislab.Modules.Catalog.Features.v1.Categories.UpdateCategory;
using Trislab.Modules.Catalog.Features.v1.Products.AddProductImage;
using Trislab.Modules.Catalog.Features.v1.Products.AdjustProductStock;
using Trislab.Modules.Catalog.Features.v1.Products.ChangeProductPrice;
using Trislab.Modules.Catalog.Features.v1.Products.CreateProduct;
using Trislab.Modules.Catalog.Features.v1.Products.DeleteProduct;
using Trislab.Modules.Catalog.Features.v1.Products.GetProductById;
using Trislab.Modules.Catalog.Features.v1.Products.ListTrashedProducts;
using Trislab.Modules.Catalog.Features.v1.Products.RemoveProductImage;
using Trislab.Modules.Catalog.Features.v1.Products.ReorderProductImages;
using Trislab.Modules.Catalog.Features.v1.Products.RestoreProduct;
using Trislab.Modules.Catalog.Features.v1.Products.SearchProducts;
using Trislab.Modules.Catalog.Features.v1.Products.SetProductThumbnail;
using Trislab.Modules.Catalog.Features.v1.Products.UpdateProduct;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;

[assembly: TrislabModule(typeof(Trislab.Modules.Catalog.CatalogModule), 600)]

namespace Trislab.Modules.Catalog;

public sealed class CatalogModule : IModule
{
    /// <summary>Works with and without a tenant catalog; data is stamped with the tenant in both modes.</summary>
    public TenancyModes SupportedTenancyModes => TenancyModes.All;

    public void ConfigureServices(IHostApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        PermissionConstants.Register(CatalogPermissions.All);

        builder.Services.AddTrislabDbContext<CatalogDbContext>(CatalogDbContext.Schema);
        builder.Services.AddScoped<IDbInitializer, CatalogDbInitializer>();

        // OwnerType=Product policy for Files module attachments (product images).
        builder.Services.AddScoped<IFileAccessPolicy, ProductFileAccessPolicy>();

        // Keeps persisted product-image URLs pointing at their FileAsset when Files moves its object.
        builder.Services.AddIntegrationEventHandlers(typeof(CatalogModule).Assembly);

        builder.Services.AddHealthChecks()
            .AddDbContextCheck<CatalogDbContext>(
                name: "db:catalog",
                failureStatus: HealthStatus.Unhealthy);
    }

    public void ConfigureMiddleware(IApplicationBuilder app)
    {
        // No custom middleware needed
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        var versionSet = endpoints.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1))
            .ReportApiVersions()
            .Build();

        var group = endpoints
            .MapGroup("api/v{version:apiVersion}/catalog")
            .WithTags("Catalog")
            .WithApiVersionSet(versionSet)
            .RequireAuthorization();

        // Trash routes registered first so the literal `/trash` segment wins
        // over the catch-all `/{id:guid}`.
        group.MapListTrashedBrandsEndpoint();
        group.MapRestoreBrandEndpoint();
        group.MapCreateBrandEndpoint();
        group.MapUpdateBrandEndpoint();
        group.MapDeleteBrandEndpoint();
        group.MapGetBrandByIdEndpoint();
        group.MapSearchBrandsEndpoint();

        // Category /tree and /trash must be registered before /{categoryId:guid}
        // so the literal routes win.
        group.MapGetCategoryTreeEndpoint();
        group.MapListTrashedCategoriesEndpoint();
        group.MapRestoreCategoryEndpoint();
        group.MapCreateCategoryEndpoint();
        group.MapUpdateCategoryEndpoint();
        group.MapDeleteCategoryEndpoint();
        group.MapGetCategoryByIdEndpoint();
        group.MapSearchCategoriesEndpoint();

        group.MapListTrashedProductsEndpoint();
        group.MapRestoreProductEndpoint();
        group.MapCreateProductEndpoint();
        group.MapUpdateProductEndpoint();
        group.MapDeleteProductEndpoint();
        group.MapChangeProductPriceEndpoint();
        group.MapAdjustProductStockEndpoint();

        // Product images — collection sub-resource under /products/{id}/images.
        group.MapAddProductImageEndpoint();
        group.MapRemoveProductImageEndpoint();
        group.MapSetProductThumbnailEndpoint();
        group.MapReorderProductImagesEndpoint();

        group.MapGetProductByIdEndpoint();
        group.MapSearchProductsEndpoint();
    }
}
