---
description: Capture durable lessons in the closest relevant AGENTS.md file(s)
---

# Learn Stuff

Capture mistakes, corrections, and successful patterns in `AGENTS.md` files

## Core rules

1. Read relevant existing `AGENTS.md` files first.
2. Update the **closest folder where the lesson applies**.
3. Keep entries specific, actionable, and high signal.
4. Prefer local scope over root scope.

## Choosing where to write

For each lesson, choose target directory by scope:

- **Narrow/domain-specific lesson** → write in the nearest domain folder (for example `auth/AGENTS.md`).
- **Cross-cutting repo lesson** → write in repository-root `AGENTS.md`.
- **Tooling/workspace-specific lesson** → write in the nearest folder that owns that tooling.

If multiple domains are involved, split lessons across multiple local `AGENTS.md` files instead of centralizing everything at root.

(Note for pi-coding-agent: pi loads `AGENTS.md` from the session cwd and its ancestor directories. If you create a deep local `AGENTS.md`, it will apply only when sessions run from that subtree.)

## File behavior

- If target `AGENTS.md` exists: preserve existing guidance, add/update a lessons section.
- If it does not exist: create one with a minimal, focused structure.

Bootstrap template for new local files:

```markdown
# Local Agent Instructions

## Scope
Applies to this directory and its descendants.

## Lessons
- (add concise, durable lessons here)
```

You may adjust section names to match existing local style.

## What to record

Only record items that should change future behavior:

- Your own mistakes (wrong assumptions, failed commands, wrong edits)
- User corrections/preferences
- Repo/tooling surprises
- Patterns that worked well
- Patterns that failed and should be avoided

Be concrete. Prefer precise rules over vague notes.

## Source of truth for this pass

Infer lessons from:

- Current conversation and corrections
- `jj diff`
- Relevant `.agents/plans/*` plan/progress files
- Errors and retries observed during execution

## Maintenance

- Merge duplicates.
- Promote repeated corrections into stable local rules.
- Remove stale/superseded notes.
- Keep each local `AGENTS.md` concise and focused.

## Output behavior

After updates, report:

1. Which `AGENTS.md` files were changed/created
2. What was added/updated (short summary)
3. Any promoted rules
4. Any consolidations/removals

Do not dump full file contents unless explicitly requested.
