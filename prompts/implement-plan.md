---
description: Implement a pre-created plan
---
Use the subagent tool with the chain parameter to execute this workflow:

1. Read the plan / todo list
2. Identify parallelizable vs sequential tasks in the plan
3. Identify **one task** that should be started. If there is no task left, congratulations, move to step 8
4. Rewrite the task as a well-defined task, if it is not already in this shape. Use the following template for defining the task:
   - TASK
   - EXPECTED OUTCOME
   - MUST DO
   - MUST NOT DO
5. Use the "worker" agent to implement the task.
6. Use another "worker" agent to update the progress tracker file, creating marking the task as completed (use {previous} placeholder).
7. Commit the changes, use "conventional commits" format for writing the commit message, then move to the next task.
8. After all tasks are complete, launch a "worker" agent with the `simplify-code` prompt to clean up the code. Pass the commit range to the agent so that it knows exactly which code to simplify. (use {previous} placeholder)
9. After the simplify pass is complete, use the "reviewer" agent to review the work done. Pass the commit range to the reviewer agent so that it knows exactly which code to review. (use {previous} placeholder)
3. Finally, use the "worker" agent to apply the feedback from the review (use {previous} placeholder)

Execute this as a chain, passing output between steps via {previous}.

Constraints:
- Never edit source files directly
- Always verify after delegation, follow our development process
- Do not batch tasks in one delegation
- Use the plan and progress tracker files to ensure work is done.
