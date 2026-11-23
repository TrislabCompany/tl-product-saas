---
name: add-permission
description: Add a new permission end-to-end — server constant + endpoint gate, and (admin app) mirror it into the permissions catalog + route guard. Use when a new endpoint needs authorization. See modules/identity.md + frontend/admin.md.
argument-hint: "[ModuleName] [Resource] [Action]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-permission

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-permission/SKILL.md](../../../.agents/skills/add-permission/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
