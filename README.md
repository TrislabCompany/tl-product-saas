# tl-product-saas

The starter of every Trislab SaaS product, and the multi-tenant test app of the framework.

It is a thin multi-tenant host on the packages of [`tl-framework`](https://github.com/TrislabCompany/tl-framework): a .NET 11 API, a migrator, an Aspire AppHost and two React apps (`clients/admin` for the operator, `clients/dashboard` for the tenant), in English and Slovenian. It holds no framework code: the building blocks, the modules and the React UI are packages at one version, `TrislabFrameworkVersion` in `src/Directory.Packages.props` (now `0.4.0`).

## What is in it

| Part | What |
| --- | --- |
| The host | `src/Host/App.Api` registers the multi-tenant tenancy and every framework module that supports multi-tenant mode: Identity, Multitenancy, Auditing, Files, SubscriptionsUsage, Notifications and Webhooks |
| The migrator | `src/Host/App.DbMigrator` migrates every module and seeds; `seed-demo` creates the demo tenants `acme` and `globex` with users, roles and the samples' data |
| The samples | `src/Samples/`: Catalog, Tickets and Chat, with their tests, as patterns to copy; they are modules of this host |
| The React apps | `clients/admin` and `clients/dashboard`, with i18n from `@trislabcompany/framework-ui` |
| `init-product` | `pwsh scripts/init-product.ps1`: a new product keeps only the modules it chooses; the rest is removed at creation, samples included |
| `template-manifest.yaml` | The ownership of every path, for `update-from-template`; the skills are in `.agents/skills/` |
| CI | `ci / ci`: the tests, the integration tests, the lint of both apps, the image builds, Trivy, and the smoke test: the app starts, migrates and seeds in multi-tenant mode |

It is deployed in the Trislab sandbox, with demo data only. Each framework release is deployed here and smoke-tested before any product takes it.

## Run it

You need Docker, the .NET SDK in `global.json` and Node 24, and a token with `read:packages`, because the Trislab packages are on GitHub Packages:

```sh
export PACKAGES_TOKEN=<a personal token with read:packages>
npm --prefix clients/admin install
npm --prefix clients/dashboard install
dotnet run --project src/Host/App.AppHost
```

[docs/getting-started.md](docs/getting-started.md) has the details: Docker Compose, the demo accounts, the tests.

## Make a product from it

Onboarding copies this repository into the product's repository at a template release (`template-saas/vX.Y.Z`). The first pull request runs `init-product` with the modules the product keeps ([the skill](.agents/skills/init-product/SKILL.md)). From then on, scaffolding changes arrive as `update-from-template` pull requests and framework upgrades as Renovate pull requests ([docs/upgrading/README.md](docs/upgrading/README.md)).

## Documents

| Document | What |
| --- | --- |
| [docs/getting-started.md](docs/getting-started.md) | Run it, sign in, test it |
| [docs/architecture.md](docs/architecture.md) | How the host is built |
| [docs/modules.md](docs/modules.md) | The modules, the samples, adding and deleting one |
| [docs/packages.md](docs/packages.md) | How the framework packages are used here |
| [docs/theme.md](docs/theme.md) | The look of the front ends: the Trislab theme, the one file that restyles a product, a user's accent, the colour check |
| [docs/configuration.md](docs/configuration.md) | The settings of the API |
| [docs/local-ports.md](docs/local-ports.md) | Many products side by side: port blocks, the database, a shared Postgres, the Aspire dashboard |
| [docs/deployment.md](docs/deployment.md) | Images, migrations, deploy and release |
| [docs/template-releases.md](docs/template-releases.md) | How the template is released (template-only) |
| [AGENTS.md](AGENTS.md) | The guide for coding agents |

The repository is public. Its code is proprietary ([LICENSE](LICENSE)).
