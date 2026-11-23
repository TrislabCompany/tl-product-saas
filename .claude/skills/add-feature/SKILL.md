---
name: add-feature
description: Add a vertical-slice feature (command/query + handler + validator + endpoint) to an existing Trislab module. Use when adding an API endpoint or business operation to a module that already exists.
argument-hint: "[ModuleName] [Area] [FeatureName]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-feature

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-feature/SKILL.md](../../../.agents/skills/add-feature/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
