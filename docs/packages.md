# Packages

How this repository uses the packages of `tl-framework`. The framework's own page, [docs/packages.md in tl-framework](https://github.com/TrislabCompany/tl-framework/blob/main/docs/packages.md), says how they are packed and versioned.

## 1. What is used

| Kind | Packages | Where |
| --- | --- | --- |
| NuGet, building blocks | `Trislab.Framework.*` (Core, Shared, Web, Persistence, Tenancy, Eventing, Storage, …) | `src/Host/*`, `src/Samples/*` |
| NuGet, modules | `Trislab.Modules.<Name>` and `Trislab.Modules.<Name>.Contracts` for Identity, Multitenancy, Auditing, Files, Billing, Notifications and Webhooks | `src/Host/App.Api`, `src/Host/App.DbMigrator`, the samples |
| npm | `@trislabcompany/framework-ui` (i18n, the language switch, formatting by language, the Turnstile widget) | `clients/admin`, `clients/dashboard` |

A project reference to a framework module is a package reference here, so the host and the samples use the framework as a product does. Migrations ship inside each module's package, and the migrator finds them there.

## 2. One version

`src/Directory.Packages.props` sets one property and every `Trislab.*` package uses it:

```xml
<TrislabFrameworkVersion>0.2.0</TrislabFrameworkVersion>
```

The npm package is pinned to the same version in each client's `package.json` (`"@trislabcompany/framework-ui": "0.2.0"`, no range) and in its lockfile. Renovate raises all of them in one pull request per framework release ([upgrading/README.md](upgrading/README.md#the-framework-version-is-separate)).

## 3. The feed and the token

GitHub Packages asks for a token even for a package that is readable by the organization:

- `nuget.config` names the feed `https://nuget.pkg.github.com/TrislabCompany/index.json` beside nuget.org, maps `Trislab.*` to it, and reads the password from `PACKAGES_TOKEN`;
- each client's `.npmrc` sends `@trislabcompany` to `https://npm.pkg.github.com`, with the token from `PACKAGES_TOKEN`;
- **CI** and the **images** use the organisation secret `PACKAGES_READ_TOKEN`, or the workflow's token without it: `ci.yml` and `deploy.yml` pass it as `packages-token`, the reusable workflow sets `PACKAGES_TOKEN` for the test command and gives every image build the BuildKit secret `packages` (the Dockerfiles read it with `--mount=type=secret,id=packages`, so it is in no layer);
- **a developer** sets `PACKAGES_TOKEN` to a personal token with `read:packages`; **Renovate** has its own.

The packages are owned by `tl-framework`. The organisation gives this repository, and every repository created from it, the secret `PACKAGES_READ_TOKEN`. Without it, the workflow's token reads a package only when the package lists the repository under "Manage Actions access" with the role Read.

## 4. Debugging into the framework

Each package embeds its PDB and links its sources to the commit (Source Link), so you can step into framework code. To try a framework change before it is released, pack it in `tl-framework` (`dotnet pack src/App.slnx -c Release -o <folder>`) and add `<folder>` as a package source in a local `nuget.config`; never commit that.
