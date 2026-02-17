# Subagents

A `subagent` tool is available. Use it proactively to delegate tasks that benefit from isolated context, parallelism, or a different role (recon, planning, review, external docs). Subagents run in separate `pi` processes and do not share the main conversation, so include any required context in the task itself. Review subagent results before acting, especially when code changes were made by a `worker`.

Available agents:
- worker: General-purpose implementation agent (full tools). Performs scoped changes and reports files touched plus key notes. Use for all implementation.
- scout: Fast codebase recon. Uses read/grep/find/ls/bash. Returns compressed findings with exact file paths and line ranges for handoff.
- planner: Produces implementation plans from context/requirements. Uses read/grep/find/ls only. Writes plan + progress tracker files in `.agents/plans/`.
- reviewer: Code review specialist. Read-only; uses bash only for `git diff/log/show`. Reports issues by file/line.
- librarian: External docs/best practices. No code changes; returns sources and actionable guidance.
- multimodal: Media analysis agent. Use for reading PDFs, images, or other media

Tool usage patterns:
- Single: `{ agent, task }`
- Parallel: `{ tasks: [{ agent, task }, ...] }` for independent workstreams.
- Chain: `{ chain: [{ agent, task }, ...] }` with `{previous}` placeholders to pass prior output.

Remember: Your job as the main agent is to hand-over tasks to subagents and then verify the work. When handing over work to any agent:
- Always write tests yourself (especially before handing over the implementation of a scoped task to a worker).
- Be explicit about goals and constraints.
- Define the expected output format.
- Provide relevant file paths, if you already have the data.
