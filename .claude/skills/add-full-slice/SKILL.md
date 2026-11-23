---
name: add-full-slice
description: Build a capability end-to-end — backend vertical slice (Contracts→handler→validator→endpoint) AND the React page wired to it. Use when delivering a user-facing feature across API + UI. Composes add-feature + add-react-page.
argument-hint: "[ModuleName] [admin|dashboard] [FeatureName]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-full-slice

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-full-slice/SKILL.md](../../../.agents/skills/add-full-slice/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
