---
name: scout-and-plan
description: Gather context then create and review an implementation plan
---

## scout
output: context.md

Analyze the codebase for {task}

## planner
reads: context.md
output: plan.md
progress: true

Create an implementation plan based on {previous}

## plan-reviewer
reads: plan.md
progress: true

Review the implementation plan from {previous}

---
**Usage: Always pass chainDir**

```typescript
{ chain: "scout-and-plan", task: "Implement X", chainDir: ".agents/plans/<timestamp--slug>", sessionDir: "~/.pi/agent/sessions/subagent" }
```
