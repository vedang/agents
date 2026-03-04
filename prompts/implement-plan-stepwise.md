---
description: Implement a pre-created plan, step by step
---
Use the subagent tool with the chain parameter to execute this workflow:

1. Read the plan.md file shared: $@
2. Identify **one task** that should be started. If there is no task left, congratulations, move to the reviewer step
3. Rewrite the task as a well-defined task, if it is not already in this shape. Use the following template for defining the task:
   - TASK
   - EXPECTED OUTCOME
   - MUST DO
   - MUST NOT DO
4. Use the "worker" agent to implement the task and to update the progress.md file. Create a progress.md file if it does not exist.
5. Commit the changes, use "conventional commits" format for writing the commit message, then move to the next task.
6. After all tasks are complete, launch a "worker" agent with the list of files that have been changed in the commit range. Let it to simplify the code: refactor and clean it up without changing any behaviour.
7. After the simplify pass is complete, use the "reviewer" agent to review the work done. Pass the commit range to the reviewer agent so that it knows exactly which code to review.

Execute this as a chain, passing output between steps via {task}, {previous} and {chain_dir} variables.

Constraints:
- Do not edit source files directly, ask a worker to do it
- Always verify after delegation, follow our development process
- Do not batch tasks in one delegation
- Use the plan.md and progress.md files to ensure work is done properly.
