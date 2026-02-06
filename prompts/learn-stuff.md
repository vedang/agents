---
description: Maintain `.agents/LESSONS.md` with mistakes, corrections, and high-signal patterns from recent work
---
Maintain a per-repo lessons file at `.agents/LESSONS.md`.

1. Read `.agents/LESSONS.md` first.
2. If it does not exist, create it using the template below.
3. Capture lessons from the current task/session and update the file.
4. Keep entries specific, actionable, and concise.
5. Consolidate duplicate or stale notes so the file stays high signal.

Do not treat this as a one-time journal. Treat it as persistent working memory for future sessions.

Bootstrap Template (if file is missing):

```markdown
# LESSONS

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|-----------------|--------------------|
|      |        |                 |                    |

## User Preferences
- (accumulate stable preferences here)

## Patterns That Work
- (approaches that repeatedly work well)

## Patterns That Don’t Work
- (approaches that failed and why)

## Repo / Domain Notes
- (tooling quirks, repo constraints, architecture context)
```

Record anything that should change future behavior:

- Your own mistakes (wrong assumptions, failed commands, incorrect edits you had to redo)
- User corrections (what was requested vs what you did)
- Tooling/environment surprises in this repo
- Stable user preferences (style, process, structure)
- Effective patterns that worked particularly well
- Anti-patterns that wasted time or caused regressions

Be concrete. Prefer:
- "Assumed `make check` existed; repo has no target. Verify Makefile targets before running protocol commands."

Over vague notes like:
- "Made a mistake running checks."

When this prompt runs, infer lessons from:

- The current conversation and user corrections
- Current working-copy changes (`jj diff`)
- Relevant plan/progress files in `.agents/plans/`
- Commands/errors observed during implementation

If an insight appears during work, update lessons immediately when practical (don’t wait for end-of-session if this prompt is being used interactively).

Maintenance Rules:

- Merge duplicates and promote repeated corrections to **User Preferences**.
- Remove stale or superseded notes.
- Keep total file length under ~200 lines.
- Optimize for future usefulness, not completeness.

Output Behavior:

After updating `.agents/LESSONS.md`, respond with:

1. What was added/updated (short summary)
2. Any promoted preferences/rules
3. Any removed or consolidated items

Do not dump the full file unless explicitly asked.
