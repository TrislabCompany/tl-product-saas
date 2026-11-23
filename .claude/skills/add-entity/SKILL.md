---
name: add-entity
description: Add a domain entity/aggregate with EF configuration and a migration to an existing Trislab module. Use when adding a new database-backed entity. Pairs with add-feature and create-migration.
argument-hint: "[ModuleName] [EntityName]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-entity

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-entity/SKILL.md](../../../.agents/skills/add-entity/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
