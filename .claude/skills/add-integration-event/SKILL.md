---
name: add-integration-event
description: Publish a cross-module integration event via the Outbox and handle it idempotently in another module. Use when one module must react to something that happened in another. See .claude/rules/eventing.md.
argument-hint: "[SourceModule] [EventName] [ConsumerModule]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-integration-event

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-integration-event/SKILL.md](../../../.agents/skills/add-integration-event/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
