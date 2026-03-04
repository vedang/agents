---
name: full-workflow
description: Complete workflow: gather context, plan, implement, and review
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

## worker
reads: plan.md
progress: true

Implement the plan from {previous}

## reviewer
reads: plan.md
progress: true

Review the implementation against the plan

---
**Usage: Always pass chainDir**

```typescript
{ chain: "full-workflow", task: "Implement X", chainDir: ".agents/plans/<timestamp--slug>", sessionDir: "~/.pi/agent/sessions/subagent" }
```
