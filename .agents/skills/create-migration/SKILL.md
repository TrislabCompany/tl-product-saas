---
name: create-migration
description: Create and apply an EF Core migration for a module's DbContext (into the module's own Migrations folder, correct --context). Use after changing entities/EF config. See .claude/rules/database.md.
argument-hint: "[ModuleName] [MigrationName]"
metadata:
  owner: template-saas
  ownership: shared
---

# Create Migration

Each module ships its own migrations, in the `Migrations/` folder of its runtime project
(`src/Modules/{X}/Modules.{X}/Migrations/`; a sample's under `src/Samples/`; Eventing's in
`src/BuildingBlocks/Eventing/Migrations/`), with its `{X}DbContextModelSnapshot`. Each module began with one
`Baseline` migration. The history table `__EFMigrationsHistory` is in the module's own schema. The DB is
**not** migrated at API startup; the `DbMigrator` host applies it.

## Step 0 — restore the pinned tool (first time)

```bash
dotnet tool restore     # dotnet-ef is pinned in .config/dotnet-tools.json
```

## Step 1 — BUILD FIRST (snapshot footgun)

`dotnet ef migrations add` reads the **current snapshot**, which is regenerated from a build. If you skip
the build after editing entities/config, you can generate against a stale snapshot and lose changes. Also,
`migrations remove` rewrites the snapshot — only remove the latest, and rebuild after.

```bash
dotnet build src/App.slnx
```

## Step 2 — add the migration

Specify `--project` (the module's runtime project), `--startup-project` (the API host),
`--context {X}DbContext` and `--output-dir Migrations`.

```bash
dotnet ef migrations add {MigrationName} \
  --project src/Modules/{X}/Modules.{X} \
  --startup-project src/Host/App.Api \
  --context {X}DbContext \
  --output-dir Migrations
```

## Step 3 — review the generated SQL before applying

```bash
dotnet ef migrations script --idempotent \
  --project src/Modules/{X}/Modules.{X} \
  --startup-project src/Host/App.Api \
  --context {X}DbContext
```

Check for: unintended table/column drops, non-nullable columns added without a default to an existing
table, and renames surfacing as drop+add (data loss). Adjust the model or hand-edit the migration if needed.

## Step 4 — apply

Preferred (the canonical path — migrates the tenant catalog then each tenant's per-module schema):

```bash
dotnet run --project src/Host/App.DbMigrator -- apply
dotnet run --project src/Host/App.DbMigrator -- list-pending   # to preview first
```

(Or, single-context local dev, `dotnet ef database update --context {X}DbContext --project … --startup-project …`.)

## Notes

- A **new module** starts with one migration named `Baseline`, and registers its context with its schema:
  `AddTrislabDbContext<{X}DbContext>({X}DbContext.Schema)` — see `add-module`. `ModuleMigrationsTests`
  (`Architecture.Tests`) fails when a module's context has no migrations in its own project.
- Never edit or squash a released migration; add a new one (expand, then contract: `docs/deployment.md`).
- `dotnet ef` against a `BaseDbContext` works because the 4-arg ctor is satisfied by the startup host's DI.

## More

[reference.md](reference.md) has the real context names, how the DbMigrator applies migrations, the naming convention and a troubleshooting table.

## Checklist

- [ ] `dotnet tool restore` done (first time)
- [ ] Built **before** `migrations add`
- [ ] `--project` the module + `--context {X}DbContext` + `--output-dir Migrations`
- [ ] Reviewed the generated SQL for data loss
- [ ] Applied via DbMigrator `apply` (or `ef database update` for one context locally)
