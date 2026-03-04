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
USAGE EXAMPLE:

To use this chain with session tracking (recommended for ccusage-pi):

{
  chain: "scout-and-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/my-work",
  sessionDir: "~/.pi/agent/sessions/subagent"
}

Without session tracking (default):

{
  chain: "scout-and-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/my-work"
}
