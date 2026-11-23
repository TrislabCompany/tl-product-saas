---
name: add-module
description: Create a new module (bounded context) — runtime + Contracts projects, IModule, DbContext, permissions, migrations, and the four registration sites. Use when adding a distinct business domain. For a feature in an existing module, use add-feature.
argument-hint: "[ModuleName]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-module

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-module/SKILL.md](../../../.agents/skills/add-module/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
