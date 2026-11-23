---
name: create-migration
description: Create and apply an EF Core migration for a module's DbContext (into the module's own Migrations folder, correct --context). Use after changing entities/EF config. See .claude/rules/database.md.
argument-hint: "[ModuleName] [MigrationName]"
metadata:
  owner: template-saas
  ownership: shared
---

# create-migration

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/create-migration/SKILL.md](../../../.agents/skills/create-migration/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
