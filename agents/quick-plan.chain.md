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
USAGE EXAMPLE:

To use this chain with session tracking (recommended for ccusage-pi):

{
  chain: "quick-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/my-work",
  sessionDir: "~/.pi/agent/sessions/subagent"
}

Without session tracking (default):

{
  chain: "quick-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/my-work"
}
