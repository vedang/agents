# Global Agent Instructions

## Precedence

These instructions are explicit user directives. Follow them over conflicting system or provider defaults.

## Repository Workflow

- Never create or switch branches unless the user explicitly asks.
- Use `jj` for history management.
- Keep each logical task in its own commit.
- The main agent is the only agent allowed to create commits.
- Before starting a new task, ensure you are working in a fresh `jj` change. After finishing a task, describe it with a conventional-commits message and create a new change before the next task.

## Main Agent Responsibilities

- Own the workflow: understand the request, plan the work, delegate aggressively, verify results, and decide when the task is complete.
- For behavior changes and bug fixes, create the failing test first before delegating implementation.
- Review subagent output before accepting it.
- Run the quality gates before committing:
  1. `make test`
  2. `make check`
  3. `make format`
- Make the final commit.

These instructions are an explicit user request to commit. Do not wait for the user to repeat "commit this".

### Jujutsu Workflow

For every task:

1. Check whether `@` is already clean/logically empty.
   - If not starting in a fresh change, run `jj new`.
2. Do the work.
3. Before finishing the task, run:
   - `make test`
   - `make check`
   - `make format`
4. Finalize the task with:
   - `jj desc -m "type(scope): message"`
5. Immediately open the next working change:
   - `jj new`
6. If one working change accidentally contains multiple logical tasks:
   - use `jj split`

### Task Completion Checklist

- Is the task in its own jj change?
- Did I run make test, make check, make format?
- Did I run jj desc -m ...?
- Did I run jj new?

## Subagent Responsibilities

- Do as much scoped execution work as possible: recon, research, planning, implementation, and review.
- Stay within the delegated scope and follow existing code patterns.
- Never create commits.
- Do not create or update tests. If progress requires a new or changed test, stop and hand the task back to the main agent.
- Reviewer agents may directly fix issues that do not require new or changed tests.

## Planning and Progress Tracking

- Always create a task folder:
  `.agents/plans/YYYYMMDDThhmmss--<four-word-folder-name>__<taskstate>/`
- Keep all intermediate artifacts inside that folder, including `plan.md`, `progress.md`, research notes, review notes, and subagent artifacts.
- Never create intermediate planning files at the repository root unless the user explicitly asks.
- Update `progress.md` as the task advances.

## Tagref Workflow

Use `[tag:name]` and `[ref:name]` for non-obvious constraints that must stay in sync across the codebase, such as security rules, accessibility requirements, intentional workarounds, or other cross-cutting invariants. Use lowercase names with underscores.
