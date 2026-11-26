# Scripts

Repetitive work is done by scripts. Each prints a summary and its errors, never a dump.

| Script | When to use it |
| --- | --- |
| `pwsh scripts/init-product.ps1 -Keep <modules> -Slug <id> -PortBlock <n>` | Once, in the first pull request of a new product: removes the modules the product does not keep, the samples included, and what only the template needs, and writes the product's local ports and database ([docs/local-ports.md](../docs/local-ports.md)). `-DryRun` shows what it would do. Template-only: it deletes itself. See the [`init-product` skill](../.agents/skills/init-product/SKILL.md) |
| `node scripts/affected-tests.mjs` | Before every push, and in `ci / ci` on a PR: runs the parts of the tests the branch affects (the .NET tests, each React app, the smoke test), by the rules at the top of the script. `--dry-run` only prints them, `--all` runs everything. A path no rule knows runs every part ([getting-started.md](../docs/getting-started.md#6-run-the-tests)) |
| `bash scripts/smoke-test.sh` | Before a push that touches the host, the migrator, a module registration or the seed, and in `ci / ci`: starts a throw-away Postgres, runs the migrator (`apply --seed`, `seed-demo`), starts the API and signs in as the demo admins. Needs Docker, the .NET SDK and `PACKAGES_TOKEN` |
| `bash scripts/test-clients.sh [app...]` | Before a push that touches a React app, and in `ci / ci`: lints each app, or only the ones named, and runs its Playwright tests against its dev server, with every API call mocked. Needs Node and `PACKAGES_TOKEN` |
| `pwsh scripts/check-template-manifest.ps1` | After adding or moving a file or a skill in the template, and in `ci / ci`: every path has an ownership in `template-manifest.yaml`, every skill has a pointer. Passes at once in a product repository |
| `node scripts/update-from-template.mjs` | Taking the next template release: without options it says what the update brings; `--apply --report <file>` applies it by the ownership in the template's manifest, bumps `.template-version` and writes the PR body with the conflicts and suggestions. The [`update-from-template` skill](../.agents/skills/update-from-template/SKILL.md) runs it ([upgrading/README.md](../docs/upgrading/README.md)). Platform-owned, the same in every template |

## The tags `init-product` reads

A line that belongs to a removable module ends with a comment `[module:<Name>]`; a block sits between `[module:<Name>:begin]` and `[module:<Name>:end]`. The comment is the one of the file's language (`//`, `<!-- -->`, `{/* */}`, `#`). The names are `SubscriptionsUsage`, `Files`, `Notifications`, `Webhooks`, `Catalog`, `Tickets` and `Chat`; `Samples` tags the solution folder of `src/Samples`. A tag of a module that is kept is stripped, so a product has none. [template-releases.md](../docs/template-releases.md#the-init-script) says what to do when you add a module or a line.
