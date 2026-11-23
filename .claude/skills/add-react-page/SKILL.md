---
name: add-react-page
description: Add a list+create page to a React app (clients/admin or clients/dashboard) — API module, page, lazy route, (admin) permission gate, Playwright test. Use when adding any frontend screen. See .claude/rules/frontend/.
argument-hint: "[admin|dashboard] [Area] [Resource]"
metadata:
  owner: template-saas
  ownership: shared
---

# add-react-page

A pointer, so that Claude Code lists this skill: it finds skills only in `.claude/skills/`. Read [.agents/skills/add-react-page/SKILL.md](../../../.agents/skills/add-react-page/SKILL.md) and follow it exactly. That file is the skill; edit it, not this one, and keep the front matter of both the same (`AgentFilesTests` in `src/Tests/Architecture.Tests` checks it).
