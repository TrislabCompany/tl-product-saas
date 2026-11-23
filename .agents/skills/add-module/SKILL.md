---
name: add-module
description: Create a new module (bounded context) — runtime + Contracts projects, IModule, DbContext, permissions, migrations, and the four registration sites. Use when adding a distinct business domain. For a feature in an existing module, use add-feature.
argument-hint: "[ModuleName]"
metadata:
  owner: template-saas
  ownership: shared
---

# Add Module

High-ceremony. The part people get wrong is **registration — a module must be wired in FOUR places**
(see Step 6). Architecture rules: `.claude/rules/architecture.md`.

## Is it really a new module?

A new module has its own domain entities and is a distinct bounded context. An operation in an existing domain is a feature: use `add-feature` or `add-full-slice` instead.

## Projects

```
src/Modules/{Name}/
├── Modules.{Name}/            ← runtime (internal): Domain/, Data/, Features/v1/, {Name}Module.cs
└── Modules.{Name}.Contracts/  ← public API: v1/ (commands/queries), Dtos/, Authorization/, Events/
```

**Copy an existing module's two `.csproj` files** (e.g. `Modules.Catalog`) and rename — don't hand-write
project references. The runtime project references its Contracts project + the BuildingBlocks it needs;
the Contracts project references `Mediator` + shared contracts.

## Step 1 — `[TrislabModule]` is an ASSEMBLY attribute (not class-level)

In `{Name}Module.cs`, above the namespace:

```csharp
[assembly: TrislabModule(typeof(Trislab.Modules.{Name}.{Name}Module), 900)]   // (Type, order)

namespace Trislab.Modules.{Name};

public sealed class {Name}Module : IModule
{
    // Required: TenancyModes.All, or Multitenant when the module needs the tenant catalog.
    public TenancyModes SupportedTenancyModes => TenancyModes.All;

    public void ConfigureServices(IHostApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        PermissionConstants.Register({Name}Permissions.All);
        builder.Services.AddTrislabDbContext<{Name}DbContext>();
        builder.Services.AddScoped<IDbInitializer, {Name}DbInitializer>();

        // Only if the module HANDLES integration events:
        // builder.Services.AddIntegrationEventHandlers(typeof({Name}Module).Assembly);
        //
        // Publishing needs no registration at all — the outbox is framework-owned
        // (host calls AddEventingCore once). Inject IOutboxWriter and publish.
        // Never register a per-module outbox store; see .agents/rules/eventing.md.

        builder.Services.AddHealthChecks()
            .AddDbContextCheck<{Name}DbContext>(name: "db:{name}");
    }

    public void ConfigureMiddleware(IApplicationBuilder app) { }   // optional, runs after auth

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        var versionSet = endpoints.NewApiVersionSet().HasApiVersion(new ApiVersion(1)).ReportApiVersions().Build();
        var group = endpoints.MapGroup("api/v{version:apiVersion}/{name}")
            .WithTags("{Name}").WithApiVersionSet(versionSet).RequireAuthorization();
        // group.MapCreate{Entity}Endpoint();  …
    }
}
```

`Order` controls load sequence (Auditing 300, Files 350, Webhooks 400, Billing 500, Catalog 600, Tickets 700, Notifications 750, Chat 800). If your module consumes another's events, load after it.

## Step 2 — Permissions (Contracts/Authorization)

`{Name}Permissions` with nested resource classes and an `All` collection registered via `PermissionConstants.Register({Name}Permissions.All)`. Mirror the shape of `CatalogPermissions`.

## Step 3 — DbContext (extends `BaseDbContext`)

```csharp
public sealed class {Name}DbContext : BaseDbContext
{
    public const string Schema = "{name}";

    public {Name}DbContext(
        IMultiTenantContextAccessor<AppTenantInfo> multiTenantContextAccessor,
        DbContextOptions<{Name}DbContext> options,
        IOptions<DatabaseOptions> settings,
        IHostEnvironment environment)
        : base(multiTenantContextAccessor, options, settings, environment) { }

    public DbSet<{Entity}> {Entities} => Set<{Entity}>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof({Name}DbContext).Assembly);
        base.OnModelCreating(modelBuilder);   // MUST be last — applies tenant + soft-delete filters
    }
}
```

## Step 3b — Localization catalog (module-owned messages)

Every client-visible message the module throws or validates lives in its own resx catalog, so the
module ships localized from its first feature. Mirror `Modules.Tickets/Localization/`:

```csharp
// src/Modules/{Name}/Modules.{Name}/Localization/{Name}Resources.cs
namespace Trislab.Modules.{Name}.Localization;

/// <summary>Marker type binding <c>IStringLocalizer&lt;{Name}Resources&gt;</c> to the {Name} resx catalog.</summary>
public sealed class {Name}Resources;
```

- `Localization/{Name}Resources.resx` next to the marker: the neutral (English) catalog. Copy
  `TicketsResources.resx` and delete its `<data>` entries. `Localization/{Name}Resources.pt-BR.resx`
  is optional; a missing translation falls back to English.
- The embedded resource must be named after the marker's full name
  (`Trislab.Modules.{Name}.Localization.{Name}Resources`). Because each resx sits next to a `.cs` file of the
  same base name, the SDK names it after the class declared in that file
  (`EmbeddedResourceUseDependentUponConvention`), so keep the marker's class name equal to its file
  name; no `<EmbeddedResource>` item is needed.
- Add `S2094` to the runtime csproj's `<NoWarn>` (the marker is an empty class on purpose).
- No per-module registration: `AddTrislabLocalization` in the host serves every catalog.

Throws use `.Localized<{Name}Resources>("{Name}.Case", args)` and validators inject
`IStringLocalizer<{Name}Resources>` (see **add-feature**). Once the module is referenced from
`App.Api` (Step 4), `Architecture.Tests` picks the catalog up on its own: `CatalogParityTests`
checks the pt-BR file against the neutral one and `LocalizedKeyReferenceTests` fails on any key the
code uses that the catalog lacks, which also catches a wrong manifest name. Rules: `.agents/rules/localization.md`.

## Step 4 — Solution + project references

```bash
dotnet sln src/App.slnx add src/Modules/{Name}/Modules.{Name}/Modules.{Name}.csproj
dotnet sln src/App.slnx add src/Modules/{Name}/Modules.{Name}.Contracts/Modules.{Name}.Contracts.csproj
```

Add a `<ProjectReference>` to the runtime module from **both** `App.Api` and `App.DbMigrator`.

## Step 5 — Migrations

The module ships its own migrations. Register its context with its schema, `AddTrislabDbContext<{Name}DbContext>({Name}DbContext.Schema)`, so its history table lives there; then create its first migration, named `Baseline`, into `Migrations/` of the runtime project (see **create-migration**, `--project src/Modules/{Name}/Modules.{Name} --output-dir Migrations`).

## Step 6 — ⚠️ Register in ALL FOUR places (the footgun)

Identical edits in **both** `App.Api/Program.cs` **and** `App.DbMigrator/Program.cs`:

1. Mediator `o.Assemblies` — add **two** markers: a Contracts type (e.g. `typeof(Trislab.Modules.{Name}.Contracts.{Name}ContractsMarker)`) **and** the module type (`typeof({Name}Module)`).
2. `moduleAssemblies` array — add `typeof({Name}Module).Assembly`.

Miss the Mediator marker → handlers silently undiscovered. Miss the assembly entry → module never loads. Miss the DbMigrator pair → migrate/seed skips the module.

## Step 7 — Verify

```bash
dotnet build src/App.slnx                  # 0 warnings
dotnet test src/Tests/Architecture.Tests           # boundary + tenant-isolation rules must pass
dotnet test src/App.slnx
dotnet run --project src/Host/App.DbMigrator -- list-pending   # the new context shows up
```

Then call one endpoint and confirm its handler runs: a missing Mediator marker compiles but leaves the handler undiscovered. Finish with the `architecture-guard` subagent.

## Checklist

- [ ] Two projects (copied csproj), added to `.slnx`, referenced from Api + DbMigrator (+ Migrations)
- [ ] `[assembly: TrislabModule(typeof({Name}Module), order)]` (assembly-level, positional)
- [ ] `IModule`: `SupportedTenancyModes`, `AddTrislabDbContext<T>()`, `PermissionConstants.Register`, version-set group, eventing trio if needed
- [ ] `{Name}DbContext : BaseDbContext`, 4-arg ctor, `base.OnModelCreating` last
- [ ] `{Name}Permissions` in Contracts/Authorization
- [ ] `Localization/{Name}Resources.cs` marker + `{Name}Resources.resx` (English; pt-BR optional), `S2094` in `<NoWarn>`
- [ ] Migrations folder + initial migration (`--context {Name}DbContext`)
- [ ] **Registered in all four places** (Api + DbMigrator × Mediator + moduleAssemblies)
- [ ] Build + Architecture.Tests green
