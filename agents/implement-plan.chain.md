---
name: implement-plan
description: Implement a pre-created plan
---

## worker
progress: true

Implement the plan specified in {task}

## reviewer
progress: true

Review the implementation against the plan from {previous}

---
**Usage: Always pass chainDir**

```typescript
{ chain: "implement-plan", task: "Implement X", chainDir: ".agents/plans/<timestamp--slug>", sessionDir: "~/.pi/agent/sessions/subagent" }
```
