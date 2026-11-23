---
paths:
  - "src/**/*.cs"
  - "src/**/*.csproj"
  - "src/Directory.*.props"
---

# Architecture rules

Modular Monolith + Vertical Slice Architecture (VSA). Read this before adding/moving modules or touching wiring.

## Layers & dependency direction

```
Host (composition root)  →  Modules.{Name} (runtime)  →  Modules.{Name}.Contracts (public API)
                         →  BuildingBlocks (shared framework)
```

- **BuildingBlocks** (`src/BuildingBlocks/`) — Core, Persistence, Web, Caching, Eventing, Storage, Quota, Jobs, Mailing, Tenancy, Shared. Consumed by all modules. **Do not modify without explicit approval.**
- **Modules** (`src/Modules/{Name}/`) — bounded contexts. Each = a runtime project (internal, with its own `Migrations/`) + a `.Contracts` project (public API: commands, queries, events, DTOs, service interfaces).
- **Samples** (`src/Samples/{Name}/`) — Catalog, Tickets and Chat, built like modules, with their tests beside them. Not part of the framework: never packed, and no building block or framework module may reference them. They move to `tl-product-saas`.
- A module **MUST NOT** reference another module's runtime project — only its `.Contracts`. Enforced by `Architecture.Tests` (NetArchTest).

## Module = runtime + Contracts

```
Modules.Identity/            ← runtime (internal): handlers, services, domain, data
Modules.Identity.Contracts/  ← public: ICommand/IQuery types, DTOs, events, service interfaces
```

Cross-module communication: through Contracts service interfaces or integration events only.

## Feature folder layout (VSA)

Each feature is a vertical slice in `Features/v{version}/{Area}/{Feature}/`:

```
Features/v1/Users/RegisterUser/
├── RegisterUserEndpoint.cs          # minimal API endpoint
├── RegisterUserCommandHandler.cs    # CQRS handler (public sealed)
└── RegisterUserCommandValidator.cs  # FluentValidation
```

Module support folders: `Domain/`, `Data/`, `Services/`, `Events/`, `Authorization/`.

## IModule registration

Each module implements `IModule`, declared via an **assembly-level** `[TrislabModule]` attribute (positional `(Type moduleType, int order = 0)`) — **not** a class-level `[TrislabModule(Order = n)]`:

```csharp
[assembly: TrislabModule(typeof(Trislab.Modules.Identity.IdentityModule), 1)]   // above the namespace

namespace Trislab.Modules.Identity;

public sealed class IdentityModule : IModule
{
    public TenancyModes SupportedTenancyModes => TenancyModes.All;   // required: Multitenant, SingleTenant or All

    public void ConfigureServices(IHostApplicationBuilder builder) { ... }
    public void ConfigureMiddleware(IApplicationBuilder app) { ... }   // optional, runs AFTER UseAuthentication
    public void MapEndpoints(IEndpointRouteBuilder endpoints) { ... }
}
```

**Tenancy modes.** Every module declares `SupportedTenancyModes` (`TenancyModes.All`, or `Multitenant` when it needs the tenant catalog, as Multitenancy and Billing do). `ModuleLoader.AddModules` throws at start-up, naming the module and `TenancyOptions:Mode`, when a module is registered in a mode it doesn't support. A host that serves both modes passes its assembly list through `ModuleLoader.SelectSupported(mode, assemblies)`. A module that supports single-tenant mode must not reference `Modules.Multitenancy` or its `.Contracts` (`Architecture.Tests` checks it), and must not assume a tenant catalog: read the tenant through `IMultiTenantContextAccessor<AppTenantInfo>`, which both modes fill. Data is stamped with the tenant in both modes.

`ModuleLoader.AddModules` (`src/BuildingBlocks/Web/Modules/ModuleLoader.cs`) discovers `[TrislabModule]` attributes, orders by `Order` then name, instantiates each, and calls `ConfigureServices`. Endpoints map under `api/v{version:apiVersion}/{module}`.

## ⚠️ The four-place registration footgun

Adding a module requires editing **four** lists. Miss one and it fails *silently*:

| Place | File | Symptom if missed |
|---|---|---|
| Mediator `o.Assemblies` (two markers: Contracts type **and** module type) | `src/Host/App.Api/Program.cs` | Handlers silently undiscovered |
| `moduleAssemblies` array | `src/Host/App.Api/Program.cs` | Module never loaded |
| Mediator assemblies (same pair) | `src/Host/App.DbMigrator/Program.cs` | Migrate/seed misses the module |
| module assemblies array | `src/Host/App.DbMigrator/Program.cs` | Migrate/seed misses the module |

After wiring, the fastest sanity check is: build, hit the endpoint, confirm the handler runs.

## DI & handler conventions

- Mediator handlers: `public sealed`, implement `ICommandHandler<T,TResponse>` / `IQueryHandler<T,TResponse>`, return `ValueTask<T>` (golden rule 5). `ServiceLifetime.Scoped`.
- Validators auto-register via `ModuleLoader` (`AddValidatorsFromAssemblies`). Name them `{Command}Validator`.
- Prefer constructor injection / primary constructors. Watch DI lifetimes: stateful singletons must be thread-safe (use `ConcurrentDictionary` / immutable snapshots).

## Middleware ordering (critical)

In `src/BuildingBlocks/Web/Extensions.cs` (`UseTrislabPlatform`):

1. ExceptionHandler → ResponseCompression
2. **CORS before HTTPS redirect** (so OPTIONS preflight isn't 307-redirected)
3. HttpsRedirection → SecurityHeaders → static files → Routing
4. **`UseAuthentication`**
5. **`UseTrislabLocalization`** — request localization, sits **between `UseAuthentication` and `UseAuthorization`** so the user-`locale`-claim culture provider can read `HttpContext.User`
6. **`UseModuleMiddlewares`** — each module's `ConfigureMiddleware`, runs **after** auth
7. RateLimiting → Quotas → `UseAuthorization` → `MapModules`

`app.UseTrislabTenancy()` (Finbuckle `UseMultiTenant()`, from the `Tenancy` building block) runs in `Program.cs` **before** `UseTrislabPlatform`, i.e. **before `UseAuthentication`**. In multi-tenant mode Finbuckle's `ClaimStrategy` authenticates on its own, so authenticated requests resolve by tenant claim and anonymous ones by the `tenant` header; in single-tenant mode the static strategy always resolves the fixed tenant and the quota middleware is not added. `builder.AddTrislabTenancy()` is called first in `Program.cs`, before `AddTrislabPlatform` and `AddModules`. See `modules/multitenancy.md`.

## Static/global state

No global mutable static collections enumerated under concurrency. `Audit` (Auditing module) swaps an immutable `IAuditEnricher[]` atomically; `ModuleLoader` guards with a lock. Follow that pattern if you must hold process-global state.

## Configuration & options

- `appsettings.json` (+ `.Development`/`.Production`) live in `src/Host/App.Api/`. DbMigrator links the same files.
- Bind config with the Options pattern: `AddOptions<T>().BindConfiguration(nameof(T))`, section name == type name (e.g. `JwtOptions`, `DatabaseOptions`, `CachingOptions`, `CorsOptions`, `QuotaOptions`, `RateLimitingOptions`; **storage section is `Storage`**, not `StorageOptions`). Add `.ValidateDataAnnotations().ValidateOnStart()` for fail-fast.
- Validate critical options via `IValidatableObject` — `JwtOptions` requires `SigningKey` ≥32 chars and **rejects placeholder strings containing `"replace-with"`**; `DatabaseOptions` rejects empty connection strings.
- **Tenancy mode** is an option, not a platform setting: `TenancyOptions:Mode` (`Multitenant` default, `SingleTenant`) and `TenancyOptions:SingleTenant:{Id,Name,Country,AdminEmail}`, read by `AddTrislabTenancy()` (`docs/configuration.md`). Code that must read the mode before the host is built uses `TenancyOptions.ReadMode(configuration)`; at run time it reads `IOptions<TenancyOptions>`.
- **Platform settings** (`Program.cs`, first line after the builder): `AddPlatformSettings()` from `Platform/PlatformConfiguration.cs` maps `DATABASE_URL`, `REDIS_URL`, `MESSAGING_URL`, `S3_*` and the secrets onto the options. It is the only code that reads those names; the migrator compiles the same file. See `docs/configuration.md`.
- **Production fail-fast** (`Program.cs`, before service registration): missing `DatabaseOptions:ConnectionString` (`DATABASE_URL`) or `JwtOptions:SigningKey` (`JWT_SIGNING_KEY`) throws. Every other service falls back to what needs no service. Local values for the AppHost are in `appsettings.Development.json` and `AppHost.cs`; the storage keys are Aspire secret parameters.
- Platform composition is one call each: `builder.AddTrislabPlatform(o => { o.Enable... })` (DI) and `app.UseTrislabPlatform(...)` (middleware). Feature flags toggle Caching/Jobs/Mailing/Quotas/Sse/Realtime/OpenTelemetry/CORS/Idempotency.
