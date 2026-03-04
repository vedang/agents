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
**Usage:**

```typescript
// With session tracking
{ chain: "quick-plan", task: "Implement X", chainDir: ".agents/plans/work", sessionDir: "~/.pi/agent/sessions/subagent" }

// Without session tracking
{ chain: "quick-plan", task: "Implement X", chainDir: ".agents/plans/work" }

// Or use helper:
// { ...runChain("quick-plan", "Implement X", ".agents/plans/work") }
```