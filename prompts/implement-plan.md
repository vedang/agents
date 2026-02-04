---
description: Implement a pre-created plan
---
Use the subagent tool with the chain parameter to execute this workflow:

1. First, use the "coordinator" agent to read and manage the execution of the this plan: $@
2. Then, use the "worker" agent to implement the task from the previous step (use {previous} placeholder).
3. Then, update the plan and related progress tracker file, clearly marking the task as completed (use {previous} placeholder). In the progress tracker, maintain a running log of:
- Conventions discovered
- Decisions made
- Issues found
- Open problems
4. Commit the changes made so far.
5. Finally, repeat from step 1, until the coordinator returns `<coordinator>COMPLETE</coordinator>` output. At this point, stop.

Execute this as a chain, using the plan and progress tracker files to ensure work is done.
