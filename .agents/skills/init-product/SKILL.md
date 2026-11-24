---
name: init-product
description: Turn a new copy of this starter into a SaaS product — choose the modules the product keeps (Billing, Files, Notifications, Webhooks, and the samples Catalog, Tickets, Chat), run scripts/init-product.ps1 to remove the rest at creation, build, test and smoke-test the result, write the product's README and AGENTS.md, and open the first pull request. Use once, when onboarding has copied tl-product-saas into a new product repository and the user asks to initialise, set up or trim the product.
metadata:
  owner: template-saas
  ownership: template-only
---

# init-product

Runs once, in the first pull request of a new product repository. The skill is `template-only`: `init-product.ps1` deletes it, with the rest of what only the template needs. Which modules there are and what each does: [docs/modules.md](../../../docs/modules.md).

## Steps

1. **Start clean.** The repository is a fresh copy of the starter at a template release (`template-saas/vX.Y.Z`), with no changes yet. Branch `init-product`.
2. **Choose the modules.** Identity, Multitenancy and Auditing are always kept: Multitenancy makes the product multi-tenant, and Identity does not start without Auditing. Ask which of the others the product needs, from its definition in `tl-product-ideas` (the hand-off brief names them):
   - framework modules: `Billing`, `Files`, `Notifications`, `Webhooks`;
   - samples: `Catalog` (needs `Files`), `Tickets`, `Chat` (needs `Files` and `Notifications`). A product keeps a sample only when it wants it as its own starting point; the rest of the samples are removed.
   - the **slug** (the product's id, such as `timesheets`) and its **port block** (from 2; the hand-off plan names it), for its local ports, database and compose project ([docs/local-ports.md](../../../docs/local-ports.md)).
3. **Dry run:** `pwsh scripts/init-product.ps1 -Keep <list> -Slug <id> -PortBlock <n> -DryRun`. Read what it would delete. `-Keep none` keeps only Identity, Multitenancy and Auditing.
4. **Run it:** `pwsh scripts/init-product.ps1 -Keep <list> -Slug <id> -PortBlock <n> -TemplateVersion <vX.Y.Z> -TemplateCommit <full sha of the tag>`. It removes the tagged lines of a removed module and strips every tag of a kept one, deletes the removed samples' folders, tests, pages and catalogs, deletes what only the template needs (`template-manifest.yaml` and the `template-only` paths), writes the local ports, the database `trislab_<slug>` and the compose project name into `.env.example` and `docker-compose.yml`, and writes `.template-version`.
5. **Delete the front-end pages of a removed framework module** by hand in `clients/admin` and `clients/dashboard` ([docs/modules.md](../../../docs/modules.md#3-delete-a-module), step 3): their pages, API calls, menu entries and permission entries. The script removes only what the samples own.
6. **Check:** `dotnet test src/App.slnx`; in each client `npm ci`, `npm run lint` and `npm run build`; `bash scripts/smoke-test.sh`. Fix what the removal broke.
7. **Write the product's own files:** `README.md` (what the product is, from its definition, no client data), and `AGENTS.md` (replace the Role block with the product's, keep the rules). The repository is public: no client names, prices or personal data.
8. **Commit and open the PR** `Initialise <product> from template-saas vX.Y.Z`. Never merge or approve it.

## Rules

- Never run it on a repository that already has product code: it deletes files.
- Never edit `template-manifest.yaml` here; it is deleted.
- A module the product needs later is not added by this skill: take it through `add-module`, or copy it from the starter at the template release in `.template-version`.
