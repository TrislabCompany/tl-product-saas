# Modules

The modules of the API, what each does, and how to add or delete one. `.claude/rules/` has the detail for the samples, written for coding agents and just as useful to people. The framework's own modules are documented in `tl-framework`.

## 1. The modules

A module is a bounded context with two projects: `Modules.<Name>`, its runtime, and `Modules.<Name>.Contracts`, the only part other modules may use: commands, queries, DTOs and integration events. Its endpoints are under `/api/v1/<module>`, and its tables in a schema of its own. It ships its own migrations and keeps its migrations history in its schema, so a product that leaves the module out gets none of its tables.

The **framework modules** come from the packages `Trislab.Modules.<Name>` and `Trislab.Modules.<Name>.Contracts` at the framework version ([packages.md](packages.md)). The **samples** Catalog, Tickets and Chat are projects in `src/Samples/`, with their tests beside them: they show how a module is built, and the host registers them like any other.

| Module | What it does | Keep it? |
| --- | --- | --- |
| Identity | Sign-in with JWTs, users, roles, permissions, groups, sessions, impersonation, two-factor sign-in | Always |
| Multitenancy | The tenant catalog, sign-up and a tenant's provisioning, activation and plan, its theme, and the tenant-expiry e-mails | Always: this host is multi-tenant through it |
| Auditing | An append-only audit trail: entity changes, security events, exceptions and HTTP activity | Always: Identity writes its security events through it |
| Files | Uploads and downloads with presigned URLs, used by Catalog's images, Chat's attachments and the users' avatars | While a module uses files |
| Billing | Plans, subscriptions, usage, and monthly invoices, marked paid by hand: there is no payment provider | When the product bills its tenants |
| Notifications | Each user's in-app inbox, pushed live over SignalR. Any module adds to it by publishing `UserNotificationRequestedIntegrationEvent` | Optional |
| Webhooks | A tenant's outgoing webhooks, signed and retried | Optional |
| Catalog | Sample: products, categories and brands, with images, search and a trash. Needs Files | A pattern to copy |
| Tickets | Sample: support tickets with comments | A pattern to copy |
| Chat | Sample: direct messages, channels, threads, reactions, mentions. Needs Files and Notifications | A pattern to copy |

Every module registered here supports multi-tenant mode. `init-product` keeps the modules a new product chooses ([section 3](#3-delete-a-module)).

## 2. Add a module

`.agents/skills/add-module/SKILL.md` is the step-by-step recipe. In short:

1. Create `src/Modules/<Name>/Modules.<Name>` and `Modules.<Name>.Contracts`, with a class that implements `IModule` (`SupportedTenancyModes` is `TenancyModes.All` or `Multitenant`) and the attribute `[assembly: TrislabModule(typeof(<Name>Module), <order>)]`, and add both projects to `src/App.slnx`. Copy a sample's two `.csproj` files: they show the package references a module needs.
2. Reference the runtime project from `App.Api` and `App.DbMigrator`.
3. Register it in four places: in both `src/Host/App.Api/Program.cs` and `src/Host/App.DbMigrator/Program.cs`, a Contracts type and a module type in the Mediator assemblies, and the module's assembly in `moduleAssemblies`. A missing Mediator type leaves its handlers silently undiscovered.
4. Register its `DbContext` with its schema, `AddTrislabDbContext<<Name>DbContext>(<Name>DbContext.Schema)`, and add its first migration, `Baseline`, into `Migrations/` of the runtime project (order 1000 and up for a product's own).
5. Add its tests (`src/Samples/<Sample>/<Name>.Tests` shows the layout), and the pages in the front end that needs them.

A module that two products need belongs in `tl-framework`, not here.

## 3. Delete a module

A new product keeps only the modules it chooses: `pwsh scripts/init-product.ps1 -Keep <modules> -Slug <id> -PortBlock <n>` removes the others at creation ([the init-product skill](../.agents/skills/init-product/SKILL.md)). It handles the lines tagged `[module:<Name>]` in the host, the migrator, the demo seed, the solution and the front ends, and a sample's folder, tests, pages, API calls and catalogs. By hand, for a module of the product itself or a framework module's pages:

1. Remove it from the four places in the two `Program.cs` files, and its project or package references from `App.Api` and `App.DbMigrator`.
2. Delete `src/Modules/<Name>` (its migrations go with it) and its tests, and remove them from `src/App.slnx`.
3. Delete its pages, API calls and menu entries in `clients/admin` and `clients/dashboard`, its permission entries, and its part of the demo data in `src/Host/App.DbMigrator/DemoSeed/DemoSeeder.cs`.
4. Run `dotnet test src/App.slnx`, `bash scripts/smoke-test.sh` and build both front ends. A module that another one still uses fails the build, through the other's reference to its `.Contracts`.

Deleting a module leaves its tables in an existing database: a later migration in another module doesn't touch them. Drop them by hand, or start the Environment's database empty.

## 4. What `Architecture.Tests` enforces

`src/Tests/Architecture.Tests` runs with every `dotnet test`, so `ci / ci` fails when a change breaks one of these rules. It checks the framework packages and the code of this repository alike:

| Area | Rules |
| --- | --- |
| Module boundaries | A module depends on another only through its `.Contracts`; no module depends on a host; no cycles between modules or projects |
| Contracts | No `DbContext`, repository, EF Core, FluentValidation or Hangfire types, and no dependency on any module's runtime |
| Features | Each feature is in a versioned folder (`Features/v1/…`); a version never depends on a newer one; commands and queries are records or sealed |
| Handlers and validators | Every command handler, and every query handler with paging, has a validator for its command or query |
| Endpoints | Static classes in the feature's namespace, with a `Map` method, a name that follows the convention, and no business logic |
| Domain | Domain types depend on no infrastructure or persistence; domain events are sealed; value objects are immutable; an aggregate refers to another only by its ID |
| Tenant isolation | Every entity of a module's `DbContext` is filtered by tenant, or marked global with `IGlobalEntity` |
| Hosts | `App.Api` doesn't reach into a module's features or data |
| Agent files | Every skill has a pointer in `.claude/skills/`, and every rule is scoped by `paths:` |

Read `.claude/rules/architecture.md` before you change a rule; it explains why each one is there.
