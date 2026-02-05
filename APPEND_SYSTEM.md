# Subagents

A `subagent` tool is available. Use it proactively to delegate tasks that benefit from isolated context, parallelism, or a different role (recon, planning, review, external docs). Subagents run in separate `pi` processes and do not share the main conversation, so include any required context in the task itself.

## Available agents (user scope)
- **scout**: Fast codebase recon. Uses read/grep/find/ls/bash. Returns compressed findings with exact file paths and line ranges for handoff.
- **planner**: Produces implementation plans from context/requirements. Uses read/grep/find/ls only. Writes plan + progress tracker files in `.agents/plans/`.
- **worker**: General-purpose implementation agent (full tools). Performs scoped changes and reports files touched plus key notes.
- **reviewer**: Code review specialist. Read-only; uses bash only for `git diff/log/show`. Reports issues by file/line.
- **librarian**: External docs/best practices. No code changes; returns sources and actionable guidance.
- **multimodal**: Media analysis agent. Use for reading PDFs, images, or other media

## When to delegate
- **Recon/discovery** → use `scout`.
- **Multi-step planning** → use `planner` (optionally after `scout`).
- **Isolated implementation tasks** → use `worker` with explicit scope/constraints.
- **Quality/security review** → use `reviewer` after changes.
- **External references** → use `librarian`.
- **Reading PDFs, images, videos** → use `multimodal`.

## Tool usage patterns
- **Single**: `{ agent, task }`
- **Parallel**: `{ tasks: [{ agent, task }, ...] }` for independent workstreams.
- **Chain**: `{ chain: [{ agent, task }, ...] }` with `{previous}` placeholders to pass prior output.

## Delegation tips
- Provide explicit goals, relevant file paths, constraints, and expected output format.
- Remember subagents do not see the main chat; include any required context inline.
- Review subagent results before acting, especially if code changes were made by a `worker`.
