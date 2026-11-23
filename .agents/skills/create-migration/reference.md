# Migrations: facts and troubleshooting

The background to [SKILL.md](SKILL.md): read it when a step fails or a context is not found.

## Facts (read before running commands)
- Each module's migrations live in its own runtime project, folder `Migrations/`, with its `{X}DbContextModelSnapshot`; the history table `__EFMigrationsHistory` is in the module's schema. Each module began with one `Baseline`.
- Startup project is `src/Host/App.Api`. Always pass `--project` (the module), `--context {X}DbContext` and `--output-dir Migrations`.
- `dotnet-ef` is pinned — `dotnet tool restore` first.
- **The DB is NOT migrated on API startup.** The `DbMigrator` host applies it: it migrates the tenant catalog (`TenantDbContext`) first, then each tenant's per-module schema, serialized by a Postgres advisory lock. (`UseTrislabTenancy()` only registers Finbuckle's tenant resolution — it does not run migrations.) In single-tenant mode (`TenancyOptions:Mode`) there is no catalog: it migrates every registered module once, for the fixed tenant.
- **Build before `migrations add`** — it reads the snapshot, which regenerates from a build; a stale snapshot silently loses changes. `migrations remove` rewrites the snapshot, so only ever remove the latest and rebuild after.

## Context names (real)
`IdentityDbContext`, `TenantDbContext` (the tenant catalog — **not** "MultitenancyDbContext"), `AuditDbContext`, `BillingDbContext`, `FilesDbContext`, `NotificationsDbContext`, `WebhookDbContext`, `EventingDbContext` (in `src/BuildingBlocks/Eventing`); the samples `CatalogDbContext`, `TicketsDbContext` and `ChatDbContext` (in `src/Samples/`).

## Apply (canonical path)
```bash
dotnet run --project src/Host/App.DbMigrator -- list-pending   # preview
dotnet run --project src/Host/App.DbMigrator -- apply [--seed]
```
(`dotnet ef database update --context {X}DbContext …` works for a single context in local dev.)

## Naming
`Add{Entity}`, `Add{Property}To{Entity}`, `Create{Index}Index`, `Rename{Old}To{New}`.

## Review the generated migration
- `dotnet ef migrations script --idempotent --context {X}DbContext …` and scan for: dropped tables/columns, non-nullable columns added to existing tables without a default, renames surfacing as drop+add (data loss).
- Check `Up()` **and** `Down()`.

## Troubleshooting
| Symptom | Cause → fix |
|---|---|
| "No DbContext was found" / multiple contexts | Always pass `--context {X}DbContext` |
| "Build failed" | `dotnet build src/App.slnx` first |
| Migration landed in the wrong project or folder | Pass `--project` (the module's runtime project) and `--output-dir Migrations` |
| Changes missing from the migration | You didn't build before `migrations add` (stale snapshot) |
| New module's context not found by ef | `App.Api` must reference the module's runtime project |
