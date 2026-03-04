# Subagents

A `subagent` tool is available. Use it proactively to delegate tasks that benefit from isolated context, parallelism, or a different role (recon, planning, review, external docs). Subagents run in separate `pi` processes and do not share the main conversation, so include any required context in the task itself. Review subagent results before acting, especially when code changes were made by a `worker`.

Tool usage patterns:
- Single: `{ agent, task }`
- Parallel: `{ tasks: [{ agent, task }, ...] }` for independent workstreams.
- Chain: `{ chain: [{ agent, task }, ...] }` with `{previous}` placeholders to pass prior output.

**You must always create plan and progress files BEFORE calling subagents**, except when using chains with `chainDir` specified. When using chains, you do NOT need to create plan/progress files yourself. However, you should:
1. Review the created files
2. Update them if needed (e.g., add your own notes)
3. Use them for tracking overall progress

Chain tasks support template variables for context passing:

- `{task}` - Original task from the first step
- `{previous}` - Output from the previous step (aggregated for parallel steps)
- `{chain_dir}` - Path to the shared chain directory

Remember: Your job as the main agent is to hand-over tasks to subagents and then verify the work. When handing over work to any agent:
- Always write tests yourself (especially before handing over the implementation of a scoped task to a worker).
- Be explicit about goals and constraints.
- Define the expected output format.
- Provide relevant file paths, if you already have the data.
- Create plan and progress files BEFORE calling the subagent (unless using chains with `chainDir`).
- Update plan and progress files AFTER the subagent completes.
