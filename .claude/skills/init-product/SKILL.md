---
name: init-product
description: Turn a new copy of this starter into a SaaS product — choose the modules the product keeps (SubscriptionsUsage, Files, Notifications, Webhooks, and the samples Catalog, Tickets, Chat), run scripts/init-product.ps1 to remove the rest at creation, build, test and smoke-test the result, write the product's README and AGENTS.md, and open the first pull request. Use once, when onboarding has copied tl-product-saas into a new product repository and the user asks to initialise, set up or trim the product.
metadata:
  owner: template-saas
  ownership: template-only
---

# init-product

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/init-product/SKILL.md](../../../.agents/skills/init-product/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
