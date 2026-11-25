# Template releases

For the template's maintainers. This page is `template-only`: product repositories never get it. How a product repository takes a release is in [upgrading/README.md](upgrading/README.md).

## Ownership of every path

`template-manifest.yaml` gives every path of the template one ownership: `platform`, `shared`, `product`, `template-only` or `sample`. The first rule whose pattern matches a path wins; `*` matches within one folder, `**` across folders. Its `skills` list names the template's skills and their ownership, and each skill's front matter repeats it (`metadata.owner: template-saas`, `metadata.ownership`).

`pwsh scripts/check-template-manifest.ps1` runs in `ci / ci`, so it fails when:

- a file matches no rule;
- a folder in `.agents/skills/` isn't listed under `skills`, or a listed skill has no `SKILL.md`;
- a skill's front matter doesn't match its ownership, or its path has another ownership;
- a skill has no pointer `.claude/skills/<name>/SKILL.md` with the same front matter and ownership, or a pointer has no skill;
- the template block of `AGENTS.md` doesn't list exactly the `platform` and `shared` skills.

In a product repository there is no manifest, and the check passes at once.

When you add a file, give it a rule first. Choose by who changes it after the repository is created:

- `platform`: the platform team, and the product must take every change as it is;
- `shared`: a starting point the product team may adapt;
- `product`: the product's own from the first day. The samples in `src/Samples/` are `product`: `init-product` removes the ones a product does not keep, and one it keeps is the product's;
- `template-only`: about maintaining the template, or only needed to make a repository from it;
- `sample`: sample content that `init-product` always deletes and an update never copies. None today.

The rules of `template-only` and `sample` come first in `template-manifest.yaml`, because the first matching rule wins. `scripts/init-product.ps1` finds the paths to delete by these classes and has no list of its own.

## The init script

`pwsh scripts/init-product.ps1 -Keep <modules> -Slug <id> -PortBlock <n>` turns a new copy of the template into a product ([init-product skill](../.agents/skills/init-product/SKILL.md)). A change to the template must keep it working:

- A line, a block or a file that belongs to a removable module (SubscriptionsUsage, Files, Notifications, Webhooks, Catalog, Tickets, Chat) carries the tag `[module:<Name>]`, or sits between `[module:<Name>:begin]` and `[module:<Name>:end]`, in a comment of the language of its file. Without the tag, removing the module leaves a broken build.
- A new module that a product may leave out: add it to the table at the top of the script (its kind and what it needs), tag its lines, and for a sample list the files it owns outside `src/Samples/<Name>`.
- A new path that only makes sense in the template: give it the class `template-only` before the broad rules.
- Check it before a release: run the script on a copy with `-Keep none` and with everything kept, then build both (`dotnet build src/App.slnx`, `npm run build` in each client) and run `bash scripts/smoke-test.sh`.

## Changing the template

Every change is a PR to `main`, and `ci / ci` must pass. `update-from-template` and `docs/upgrading/README.md` have the same process in all three templates, apart from `metadata.owner` and the examples of the ownership table: change them in all three together. The `release` skill and `docs/deployment.md` describe how a product built from this template is deployed and released.

A framework release does not change the template by itself. Renovate raises `TrislabFrameworkVersion` in a pull request here; once `ci / ci` and the sandbox deploy pass on it, the framework release has passed its gate, and the next template release pins it.

## Releasing

The `release-template` skill does these steps:

1. Choose the version from the changes since the last tag. **Breaking** means removing or renaming a path that products use, changing a `docs/` heading a skill links to, renaming a skill or a command, adding a skill name, changing a name the infrastructure fixes (an image in `platform.yaml`, a workflow name), raising `TrislabFrameworkVersion` by a MINOR or more, or changing how the host or the migrator registers a module. Breaking is a major version (a minor under `0.x`); a feature is a minor; a fix is a patch.
2. Write the notes `docs/upgrading/template-vX.Y.Z.md` (Breaking, Requires, Changes by ownership, Upgrade steps) and add a row to the table below.
3. Open the release PR `template-saas vX.Y.Z`.
4. After the merge, when `ci` passes on the merge commit, the `template-release` workflow ([.github/workflows/template-release.yml](../.github/workflows/template-release.yml)) tags it `template-saas/vX.Y.Z` (annotated, pushed alone) and publishes the GitHub Release with the notes. Nobody tags by hand. Never a `v*` tag. A tag is never moved or deleted. If it did not run, `release-template tag` starts it with the version. When `ci` failed on the merge commit, merge the fix as a normal PR, then start it: it tags the first later commit where `ci` passed, never past the next release's notes, so the release also contains the PRs merged until then. It pushes with a token of the org's GitHub App (org variable `RELEASE_APP_ID`, org secret `RELEASE_APP_PRIVATE_KEY`), the only bypass actor of the tag ruleset `release-tag-creation`.
5. The canary, the first `active` repository of `template-saas`, takes the release first with `update-from-template`. The others follow once its update is merged and deployed.

## Releases

| Version | Breaking | Requires | Notes |
| --- | --- | --- | --- |
| `v0.1.0` | yes (first release) | `app-workflows >= v0.2.0`; framework `0.2.0`; read access of this repository to the framework's packages | [template-v0.1.0.md](upgrading/template-v0.1.0.md) |
