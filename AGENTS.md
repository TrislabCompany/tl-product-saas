# This repository

> `tl-product-saas`: the thin multi-tenant starter of every Trislab SaaS product, and the framework's multi-tenant test app. A .NET 11 host and two React 19 apps on the packages of `tl-framework` (`README.md`, `docs/`).

## Role

The same block starts the `AGENTS.md` of every Trislab repository, so an agent in any of them knows where a change belongs.

- **For:** the thin multi-tenant starter and the framework's multi-tenant test app. Onboarding copies it into each SaaS product repository, where `init-product` keeps the modules the product chooses.
- **Contains:**
  - the host (`src/Host/App.Api`), the AppHost, and the migrator with its `seed-demo` data (`src/Host/App.DbMigrator`);
  - every framework module that supports multi-tenant mode, registered, from the `Trislab.Modules.*` packages;
  - the samples Catalog, Tickets and Chat (`src/Samples/`), with their tests;
  - the two React apps in `clients/` on `@trislabcompany/framework-ui`, in English and Slovenian;
  - `scripts/init-product.ps1`, `template-manifest.yaml`, `.agents/skills/`, the coding rules and the smoke test.
- **Never contains:** framework source (only package references, at one version); a product's own features; Trislab-only code; customer names, secrets or prices; live infrastructure.
- **A change goes elsewhere when it is:**
  - a reusable building block or module, or a fix in one: `tl-framework`. It reaches this repository as a version bump;
  - single-tenant scaffolding: `tl-product-webapp`;
  - a product's own feature: that product's repository;
  - a reusable infrastructure module, stamp template or app workflow: `tl-platform`;
  - a repository, environment or hostname: `tl-cloud-infrastructure`;
  - a product idea, plan, decision or hand-off plan: `tl-product-ideas` (private).
- **Released as:** `template-saas/vX.Y.Z`, each pinning a tested framework version (`docs/template-releases.md`). It is not a package. It is deployed to the sandbox, and a framework release is smoke-tested here before any product takes it.
- **Skills:** `.agents/skills/`, listed under [Skills](#skills).
- **Scripts:** `scripts/`, listed in [`scripts/README.md`](scripts/README.md); read it first.

## This guide

This file is the canonical guide for **all** AI coding tools (Claude Code, Cursor, Codex, …).
`CLAUDE.md` only imports it: edit conventions **here**, not there.

This file is the map. Detailed conventions live in `.claude/rules/`. Each rule has `paths:` front matter, so Claude Code loads it by itself when you touch a matching file; other tools: **read the relevant rule file before working in that area** (see the index below). Keep this file lean.

## What this is

A **multi-tenant modular monolith** (Vertical Slice Architecture) backend with two **React + Vite** front ends, built on the framework's packages. The host references `Trislab.Framework.*` and `Trislab.Modules.*` at one version, `TrislabFrameworkVersion` in `src/Directory.Packages.props`; nothing of the framework is copied here ([docs/packages.md](docs/packages.md)).

- **Backend:** .NET 11, EF Core 11, PostgreSQL, Redis, JWT and ASP.NET Identity, Finbuckle multitenancy, Hangfire, OpenAPI/Scalar, Serilog and OpenTelemetry, .NET Aspire.
- **Front ends:** `clients/admin` (operator-facing) and `clients/dashboard` (tenant-facing): React 19, Vite 8, TypeScript 6, TanStack Query v5, React Router 7, Radix + Tailwind v4, i18n from `@trislabcompany/framework-ui`.

## Repo map

| Path | What |
|------|------|
| `src/Host/App.Api` | The host. `Program.cs` registers tenancy (`AddTrislabTenancy(t => t.UseMultitenant())`, `UseTrislabTenancy()`) and every module. `Platform/PlatformConfiguration.cs` maps the platform's settings onto options. |
| `src/Host/App.AppHost` | .NET Aspire orchestrator: Postgres, Valkey, rustfs storage, the migrator, the API and both React apps. |
| `src/Host/App.DbMigrator` | One-shot migrate/seed runner, the init container of `api`. `seed-demo` provisions the demo tenants `acme` and `globex`. The API never migrates at startup. |
| `src/Samples/{Name}` | The samples Catalog, Tickets and Chat, each a runtime project, its `.Contracts` and its tests: patterns to copy. They are modules of this host like any other. |
| `src/Tests/` | `Architecture.Tests` (NetArchTest) and `Integration.Tests` (Testcontainers, needs Docker). |
| `clients/admin`, `clients/dashboard` | The two React apps, each with its Dockerfile and `docker/` (nginx, `/config.json`). |
| `scripts/` | `init-product.ps1`, `affected-tests.mjs`, `smoke-test.sh`, `test-clients.sh`, `check-template-manifest.ps1`, `update-from-template.mjs` ([scripts/README.md](scripts/README.md)). |
| `template-manifest.yaml` | The ownership of every path, for `update-from-template` ([docs/template-releases.md](docs/template-releases.md)). Deleted by `init-product`. |
| `docs/` | Getting started, architecture, configuration, deployment, modules, packages, template releases. |
| `platform.yaml`, `.github/workflows/` | The images and app sizing for the platform; `ci.yml` (the check `ci / ci`), `deploy.yml`, `release.yml`. |

## Build & run

```bash
# one-time: a token with read:packages, because the Trislab packages are on GitHub Packages (docs/getting-started.md)
export PACKAGES_TOKEN=...

dotnet run --project src/Host/App.AppHost   # the whole stack; one-time: npm install in both clients
dotnet build src/App.slnx
node scripts/affected-tests.mjs             # the tests this branch affects, before every push (--all for everything)
dotnet test src/App.slnx                    # the integration tests REQUIRE Docker
bash scripts/smoke-test.sh                  # the app starts, migrates and seeds in multi-tenant mode (Docker)
bash scripts/test-clients.sh                # lint and the Playwright tests of both React apps (API mocked)

cd clients/dashboard && npm install && npm run dev   # http://localhost:5174 (admin: 5173)
```

`ci / ci` runs `node scripts/affected-tests.mjs` on a PR, and every part on a push to `main`. Before starting work, check the open issues labelled `ci-main`: a red `main` is fixed by the next PR.

Migrations and seed (the migrator, a separate step): `DATABASE_URL=... dotnet run --project src/Host/App.DbMigrator -- apply [--seed]`, `seed-demo`, `list-pending`.

## Platform contract (do not break)

- Every image that serves traffic listens on **8080** and runs as a **non-root** user; base images are pinned by digest.
- The API answers `/healthz` and `/readyz`; the front ends' nginx answers both too.
- The app reads the platform's settings (`DATABASE_URL`, `REDIS_URL`, `S3_*`, `JWT_SIGNING_KEY`, …) **only** in `src/Host/App.Api/Platform/PlatformConfiguration.cs`; everything else reads options ([docs/configuration.md](docs/configuration.md)).
- The front ends call the API at the relative path `/api` and storage at `/storage`, through their nginx; `/config.json` holds only `PLATFORM_*` and `PUBLIC_*` keys.
- Migrations are backward compatible: the previous API revision keeps serving on the migrated database.
- The images restore the Trislab packages with the BuildKit secret `packages` (the token); never put a token in a layer or a file.

## Golden rules (do not break)

1. **Never copy framework code here.** A building block or module change goes to `tl-framework` and arrives as a version bump. A product's own module goes in `src/Modules/<Name>`, with migrations ordered 1000 and up.
2. **Module boundaries**: a module references another only through its `.Contracts`. Enforced by `Architecture.Tests`.
3. **Registering a module touches FOUR places**: the Mediator `o.Assemblies` (two markers each) and the `moduleAssemblies` array of `App.Api/Program.cs`, and the identical pair in `App.DbMigrator/Program.cs`. A missing Mediator marker means handlers silently undiscovered ([docs/modules.md](docs/modules.md)).
4. **Tenant isolation is default-ON** through `BaseDbContext`; opt out only with `IGlobalEntity`. Subclass DbContexts call `base.OnModelCreating` **last**.
5. **Mediator handlers are `public sealed`**, return `ValueTask<T>`, and `.ConfigureAwait(false)` every await.
6. **Structured logging only**: message templates or `[LoggerMessage]`, never string interpolation.
7. **Propagate `CancellationToken`** into every EF and IO call.
8. **Every command handler and paginated query handler has a validator.** Enforced by `Architecture.Tests`.
9. **Frontend:** pass per-call data through `mutate(arg)`, never through state the mutation callbacks close over. Every text is in both languages, from `@trislabcompany/framework-ui`.
10. **Docs travel with the change**: a change to a setting, a module, an endpoint the front ends use or the way the product runs isn't done until `README.md` and `docs/` match it.
11. **Tags `[module:<Name>]`** in code mark what `init-product` removes with a module. Keep them on the lines of a module's registration, seed and UI; a new line that belongs to a removable module gets the tag.

## Rules index

Read the relevant file before you work (`.claude/rules/`, each scoped with `paths:`).

### Backend and cross-cutting

| Working on… | Read |
|---|---|
| C# style, naming, async, errors, comments | `coding-csharp.md` |
| Module structure, boundaries, registration, DI, middleware order, config | `architecture.md` |
| Endpoints, CQRS, validation, exceptions, permissions, versioning, contract compatibility | `api-conventions.md` |
| EF Core, entities, migrations, tenant isolation, query filters | `database.md` |
| Cross-module events, Outbox/Inbox, idempotent handlers | `eventing.md` |
| Caching, background jobs, outbound HTTP, files and storage, security, realtime | `caching.md`, `jobs.md`, `resilience.md`, `storage.md`, `security.md`, `realtime.md` |
| Logging, localization | `logging.md`, `localization.md` |
| Unit and integration tests | `testing.md`, `integration-testing.md` |
| A sample's quirks | `modules/catalog.md`, `modules/tickets.md`, `modules/chat.md` |

### Frontend

| Working on… | Read |
|---|---|
| TypeScript style, components, errors, naming | `coding-typescript.md` |
| Any React work; the operator app; the tenant app | `frontend/shared.md`, `frontend/admin.md`, `frontend/dashboard.md` |

The rules were written inside the framework and mention its `src/BuildingBlocks` and `src/Modules`: here those are the `Trislab.Framework.*` and `Trislab.Modules.*` packages, which you read and never change.

## Git and review

- Branch from `main` with a short kebab-case topic (`billing-proration`). One change per PR; a workflow change goes in its own PR.
- The PR title is an imperative plain sentence of 72 characters or fewer; it becomes the squash commit. The body follows `.github/pull_request_template.md`.
- A PR merges with the check `ci / ci` green and one code owner's approval, never your own. The author resolves the threads.
- Releases of the template are tags `template-saas/vX.Y.Z`, made only by the `template-release` workflow; never a `v*` tag by hand (`release-template` skill). A product made from this starter releases with `vX.Y.Z` tags (`release` skill).
- `.github/workflows/ci.yml` only calls the platform's reusable workflow: never add steps to it other than the test command.
- Before asking for review, run the `code-reviewer` and `architecture-guard` subagents.

## Skills

The skills are in `.agents/skills/<name>/SKILL.md`. Claude Code finds skills only in `.claude/skills/`, so each also has a pointer there with the same front matter (`AgentFilesTests` checks it).

### Template skills

Owned by the template. Every `update-from-template` PR rewrites this block; don't edit it.

<!-- template-skills:start -->
| Skill | Use when |
| --- | --- |
| [`release`](.agents/skills/release/SKILL.md) | Deploying, releasing a new version, promoting to production, or asking which version runs where |
| [`update-from-template`](.agents/skills/update-from-template/SKILL.md) | Taking the next template release into this repository, as one PR |
| [`add-feature`](.agents/skills/add-feature/SKILL.md) | Adding a command or query to an existing module |
| [`add-entity`](.agents/skills/add-entity/SKILL.md) | Adding a domain entity with its EF configuration and migration |
| [`add-module`](.agents/skills/add-module/SKILL.md) | Adding a new module (bounded context) of the product |
| [`add-full-slice`](.agents/skills/add-full-slice/SKILL.md) | Adding an entity with its endpoints, tests and page in one go |
| [`add-react-page`](.agents/skills/add-react-page/SKILL.md) | Adding a page to a React app |
| [`add-permission`](.agents/skills/add-permission/SKILL.md) | Adding a permission and mirroring it in the front end |
| [`add-integration-event`](.agents/skills/add-integration-event/SKILL.md) | Publishing or handling an event across modules |
| [`create-migration`](.agents/skills/create-migration/SKILL.md) | Creating an EF Core migration for a module |
| [`mediator-reference`](.agents/skills/mediator-reference/SKILL.md) | Reference for the Mediator library's patterns (the agent loads it) |
| [`query-patterns`](.agents/skills/query-patterns/SKILL.md) | Reference for EF Core query patterns (the agent loads it) |
| [`testing-guide`](.agents/skills/testing-guide/SKILL.md) | Reference for the test conventions (the agent loads it) |
<!-- template-skills:end -->

### Template-only skills

Only in the template repository; `init-product` removes them: `init-product` (turn a new copy into a product) and `release-template` (release the template).

### Project skills

This repository's own skills. An update never reads, changes or deletes them. A project skill's front matter carries `metadata.owner: project`, and its name must not be one a template skill uses.

| Skill | Use when |
| --- | --- |
| — | None yet |

## Working here

- **No AI attribution.** No `Co-Authored-By:` trailer and no "generated with" line in a commit, PR or comment.
- **Commit with your Trislab account**, never a personal one or another employer's.
- **The repository is public.** No secrets, customer names, prices or internal URLs in code, docs, PRs or commits. The demo password in the seed is public by design and only for `SEED_DEMO`.
- **Tools are pinned:** the SDK in `global.json`, `dotnet-ef` in `.config/dotnet-tools.json`, packages in `src/Directory.Packages.props`. The build runs with `TreatWarningsAsErrors`: a warning fails it.
- **Repetitive work is done by scripts.** When the same kind of work comes back and a script would make it faster, add one to `scripts/`, list it in `scripts/README.md`, and name it in the skill or doc that uses it. No script for one-off work.
- Write "section N", never "§".
