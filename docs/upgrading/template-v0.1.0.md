# template-saas v0.1.0

The first release of the SaaS starter: the thin multi-tenant host and the framework's multi-tenant test app, on the packages of `tl-framework` `0.2.0`.

## Breaking

Yes (first release). A SaaS repository made before this release has no `.template-version`, so its update is an untracked one (see "An untracked repository" in `.agents/skills/update-from-template/SKILL.md`).

## Requires

- `app-workflows >= v0.2.0` in `.github/workflows/`.
- The framework packages `0.2.0` on GitHub Packages, and the organisation secret `PACKAGES_READ_TOKEN` (a classic token with `read:packages`) given to the repository; without it, each package must list the repository under "Manage Actions access". `PACKAGES_TOKEN` (a token with `read:packages`) for developers and Renovate.

## Changes by ownership

### platform

- `.github/workflows/`: `ci.yml`, `deploy.yml` and `release.yml` pinned to `app-workflows/v0.2.0`; `ci.yml` and `deploy.yml` pass the workflow's token to the reusable workflow as `packages-token`.
- `.agents/skills/release/`, `.agents/skills/update-from-template/`, `docs/upgrading/README.md`, `CLAUDE.md`, `renovate.json`, `platform.schema.json`, `scripts/check-template-manifest.ps1`.

### shared

- `AGENTS.md`, `.claude/rules/`, the scaffolding skills, `docs/`, `scripts/smoke-test.sh`.
- `src/Host/` (the host, the AppHost, the migrator and its demo seed), `src/Directory.*.props` with `TrislabFrameworkVersion`, `src/Tests/` (`Architecture.Tests` and `Integration.Tests`), `clients/` (the two React apps; their i18n is `@trislabcompany/framework-ui`), `nuget.config`, the Dockerfiles and `docker-compose.yml` (the packages are restored with the BuildKit secret `packages`).

### product

Shown as suggestions only: `src/Samples/` (Catalog, Tickets, Chat), `README.md`, `platform.yaml`, `.trivyignore`, `.env.example`, `clients/*/package.json` and lockfiles.

### template-only

`template-manifest.yaml`, `scripts/init-product.ps1`, the skills `init-product` and `release-template`, `docs/template-releases.md`, `.github/workflows/template-release.yml`.

## Upgrade steps

None: this is the first release.
