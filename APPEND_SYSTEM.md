# Main-Agent Delegation Playbook

Use subagents by default for scoped work. The main agent should spend most of its effort on task decomposition, test ownership, verification, and quality control.

## Before Delegating

- Choose a `TASK_DIR` under `.agents/plans/...__inprogress/`.
- For single or parallel subagent runs, create `plan.md` and `progress.md` in `TASK_DIR` before delegating.
- For chain runs, pass `chainDir=TASK_DIR`, then review and update the generated artifacts afterward.
- If the task changes behavior or fixes a bug, add the failing test first in the main agent before handing implementation to a subagent.
- Give the subagent a tight scope, relevant file paths, constraints, and an explicit output format.

## After Delegating

- Review the subagent’s output and changed files.
- Update `progress.md` with what happened.
- If the subagent discovers that new or changed tests are required, take the task back in the main agent and add the tests before delegating again.
- Run `make test`, `make check`, and `make format` before committing.
- Commit from the main agent.

## Invocation Rules

- Single runs: keep `output` and optional `sessionDir` inside `TASK_DIR`.
- Parallel runs: prefer a chain with `chainDir=TASK_DIR`; otherwise give each task explicit artifact paths under `TASK_DIR`.
- Chain runs: always pass `chainDir=TASK_DIR`.
