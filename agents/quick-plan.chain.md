---
name: quick-plan
description: Quickly gather context and create a plan (without review)
---

## scout
output: context.md

Analyze the codebase for {task}

## planner
reads: context.md
output: plan.md
progress: true

Create an implementation plan based on {previous}

---
**Usage: Always pass chainDir**

```typescript
{ chain: "quick-plan", task: "Implement X", chainDir: ".agents/plans/<timestamp--slug>", sessionDir: "~/.pi/agent/sessions/subagent" }
```
