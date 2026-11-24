# Scripts

Repetitive work is done by scripts. Each prints a summary and its errors, never a dump.

| Script | When to use it |
| --- | --- |
| `pwsh scripts/init-product.ps1 -Keep <modules> -Slug <id> -PortBlock <n>` | Once, in the first pull request of a new product: removes the modules the product does not keep, the samples included, and what only the template needs, and writes the product's local ports and database ([docs/local-ports.md](../docs/local-ports.md)). `-DryRun` shows what it would do. Template-only: it deletes itself. See the [`init-product` skill](../.agents/skills/init-product/SKILL.md) |
| `bash scripts/smoke-test.sh` | Before a push that touches the host, the migrator, a module registration or the seed, and in `ci / ci`: starts a throw-away Postgres, runs the migrator (`apply --seed`, `seed-demo`), starts the API and signs in as the demo admins. Needs Docker, the .NET SDK and `PACKAGES_TOKEN` |
| `pwsh scripts/check-template-manifest.ps1` | After adding or moving a file or a skill in the template, and in `ci / ci`: every path has an ownership in `template-manifest.yaml`, every skill has a pointer. Passes at once in a product repository |

## The tags `init-product` reads

A line that belongs to a removable module ends with a comment `[module:<Name>]`; a block sits between `[module:<Name>:begin]` and `[module:<Name>:end]`. The comment is the one of the file's language (`//`, `<!-- -->`, `{/* */}`, `#`). The names are `Billing`, `Files`, `Notifications`, `Webhooks`, `Catalog`, `Tickets` and `Chat`; `Samples` tags the solution folder of `src/Samples`. A tag of a module that is kept is stripped, so a product has none. [template-releases.md](../docs/template-releases.md#the-init-script) says what to do when you add a module or a line.
