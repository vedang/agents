# Pi extension review: `learn-stuff-2`, `loop`, `notify`, `protected-paths`, `status-line`, `todo`

This note is a source-based review of the requested extensions. It focuses on:
- what each extension does,
- how it is triggered,
- what it depends on,
- and what might make it feel broken or not worth keeping.

I have **not** runtime-tested these here; this is based on reading the code.

---

## Quick triage

| Extension | Main purpose | Trigger surface | Dependency level | My pruning-oriented read |
| --- | --- | --- | --- | --- |
| `pi-extensions/learn-stuff-2.ts` | Force a lessons block into responses and persist lessons into `AGENTS.md` | `before_agent_start`, `tool_call`, `agent_end`, two commands | High | Powerful, but only useful if you want the lessons workflow and the model consistently follows the format |
| `pi-extensions/loop.ts` | Re-run the agent until a breakout condition is met | `/loop`, `agent_end`, custom tool, compaction/session hooks | High | Sophisticated and useful, but one of the easiest to misconfigure or find surprising |
| `pi-extensions/notify.ts` | Native terminal notification when Pi is ready again | `agent_end` | Low | Very likely to work if your terminal supports the chosen protocol; simple keep/prune decision |
| `pi-extensions/protected-paths.ts` | Block writes to sensitive paths | `tool_call` for `write`/`edit` | Low | Simple and likely effective, but matching logic is intentionally crude |
| `pi-extensions/status-line.ts` | Show a demo status line with turn progress | session + turn events | Low | Looks like a demo/example more than a must-keep extension |
| `pi-extensions/todo.ts` | Add an LLM-managed todo tool and `/todos` viewer | custom tool + `/todos` + session events | Medium | Nice example, probably useful if you want branch-aware todos; otherwise redundant noise |

---

## 1) `pi-extensions/learn-stuff-2.ts`

### What it does
This extension implements a **lessons-oriented workflow**.

It does three main things:

1. **Injects extra instructions into the system prompt** before the agent starts.
   - It appends a `learn-stuff-2` instruction block telling the assistant to include a `★ Lessons` block at the end of every response.

2. **Tracks which files were modified** during the turn.
   - It listens for `write` and `edit` tool calls and records the touched paths.

3. **Extracts lessons from the assistant’s final response and persists them into an `AGENTS.md` file**.
   - On `agent_end`, it reads the latest assistant text output.
   - It looks for a `★ Lessons` block.
   - It deduplicates the lessons.
   - It decides which `AGENTS.md` file is the best target.
   - It merges the new lessons into a `## Lessons` section in that file.

It also registers two commands:

- `/learn-stuff:show-lessons`
  - scans the repo for `AGENTS.md` files,
  - extracts all `## Lessons` sections,
  - and pushes a digest message back into Pi.

- `/learn-stuff:add-lesson <text>`
  - manually appends a lesson to `cwd/AGENTS.md`.

### Key implementation details

- It uses a sentinel string:
  - `You are in 'learn-stuff-2' mode`
  - so it can avoid appending the same instruction twice.

- The lesson parser is fairly robust:
  - strips wrapping backticks,
  - removes bullet prefixes,
  - normalizes whitespace,
  - uses stemming and stopword removal,
  - and does fuzzy duplicate detection using Jaccard similarity.

- It tries to pick a **single best `AGENTS.md` target** for the whole turn.
  - It prefers files inside the project root.
  - It deprioritizes top-level `.agents` as a persistence target.
  - If no nearby `AGENTS.md` exists, it may target a new `AGENTS.md` next to the modified file.

- It scans upward for project root by looking for `.git` or `.jj`.

### Why it may work well
- If your setup already expects or encourages a lessons block, this is a strong fit.
- It keeps lessons close to the code via `AGENTS.md`, which is useful if you actually revisit those files later.
- The deduplication logic is much more thoughtful than a naive append-only implementation.

### Why it might feel broken or not worth keeping
- It **depends on the assistant actually producing the expected `★ Lessons` block**. If your model ignores the injected format, persistence silently won’t happen.
- It only persists lessons when there were `write` or `edit` tool calls. Pure analysis/chat turns do not create persisted lessons.
- It only reads the **latest assistant text output** on `agent_end`. If the turn ends unusually or the output is nonstandard, lessons may not be extracted.
- It writes into `AGENTS.md`, which is a strong opinionated workflow. If you do not want your repo documentation updated automatically, this extension is more annoying than helpful.
- It may create or update `AGENTS.md` in places you did not expect if modified files do not already live near one.

### Pruning-oriented summary
Keep this if you actively want **lessons capture as part of your coding workflow**.
Prune it if the lessons block feels like response clutter, or if automatic `AGENTS.md` edits are not something you want.

---

## 2) `pi-extensions/loop.ts`

### What it does
This extension adds a **follow-up loop** mechanism.

It registers:
- a `/loop` command
- and a custom `signal_loop_success` tool.

The idea is:
1. you start a loop with a breakout condition,
2. the extension keeps sending a follow-up prompt at the end of each turn,
3. and the loop stops only when the agent calls `signal_loop_success`.

Supported loop modes:
- `tests` → keep going until tests pass
- `custom <condition>` → keep going until your condition is satisfied
- `self` → let the agent decide when it is done

### What `/loop` does
If you run `/loop` with arguments:
- `/loop tests`
- `/loop custom all snapshots are updated`
- `/loop self`

it parses the mode directly.

If you run `/loop` without arguments in UI mode, it opens a selector UI where you choose a preset.
For `custom`, it then opens an editor prompt to collect the condition.

Once started, the extension:
- stores loop state in a custom session entry (`loop-state`),
- shows a loop widget in the UI,
- triggers an immediate follow-up message to start the loop,
- increments a turn counter each time it fires.

### How the loop continues
On every `agent_end`:
- if the loop is active and there are no pending messages,
- it sends the loop prompt again as a follow-up message.

Example loop prompts:
- tests mode: “Run all tests. If they are passing, call the signal_loop_success tool...”
- custom mode: “Continue until the following condition is satisfied: ...”
- self mode: “Continue until you are done...”

### How the loop stops
It registers a tool named `signal_loop_success`.
If the agent calls that tool while a loop is active, the extension clears the loop state and returns “Loop ended.”

There is also an abort-handling path:
- if the last assistant message ended with stop reason `aborted`,
- and UI is available,
- it asks whether to break the active loop.

### Extra behavior
- It summarizes the breakout condition into a short status string using a model call.
  - If the current provider is Anthropic, it tries to use `claude-haiku-4-5` for that summary.
  - Otherwise it uses the current model.
  - If summarization fails, it falls back to a simple local summary.

- It customizes compaction.
  - On `session_before_compact`, it tries to preserve the active loop’s breakout condition in the compacted summary.

- It restores state on `session_start` and `session_switch` by reading the most recent `loop-state` custom entry.

### Why it may work well
- It is a clever automation tool for repetitive “keep iterating until X” workflows.
- The session-persisted state is thoughtful: loops survive session restoration and compaction better than a naive in-memory loop would.
- The UI widget and short summary make the loop status visible.

### Why it might feel broken or not worth keeping
- It is **behaviorally invasive**: once active, it keeps pushing follow-up turns until the tool is called. If you forget a loop is active, Pi may feel like it is “running on its own.”
- It depends on the agent reliably calling `signal_loop_success`. If the model misses that instruction, the loop can keep going.
- It depends on model/API-key availability for the fancy breakout summary and compaction preservation.
- Some UI notifications are called without consistently guarding `ctx.hasUI`; that may be fine if `ctx.ui` always exists, but it is less defensive than other extensions.
- The loop is tied closely to session semantics, follow-up delivery, and compaction hooks. If any of those APIs changed in your Pi version, this is the kind of extension that would show breakage first.

### Pruning-oriented summary
Keep this if you actually use “continue until condition X” workflows.
Prune it if you want predictable, one-turn-at-a-time behavior or if autonomous follow-up loops have been a source of confusion.

---

## 3) `pi-extensions/notify.ts`

### What it does
This is a very small extension that sends a **native terminal notification** whenever the agent finishes a turn and is ready for more input.

It listens to:
- `agent_end`

and then calls:
- `notify("Pi", "Ready for input")`

### Notification backends
It chooses the backend from environment variables:

- `WT_SESSION` → Windows Terminal / WSL path
  - calls `powershell.exe` to show a Windows toast

- `KITTY_WINDOW_ID` → Kitty terminal
  - emits Kitty OSC 99 sequences

- otherwise → generic OSC 777
  - intended for Ghostty, iTerm2, WezTerm, rxvt-unicode, etc.

### Why it may work well
- The logic is tiny and straightforward.
- There are no model or UI dependencies.
- If your terminal supports the selected protocol, this should be one of the easiest extensions to keep.

### Why it might feel broken or not worth keeping
- If your terminal does not support the emitted escape sequence, you may get **no notification at all**.
- In less friendly environments, raw escape codes can sometimes be ignored awkwardly or behave inconsistently.
- On Windows/WSL it assumes `powershell.exe` is available.
- It fires on **every** `agent_end`, which may be noisy if you already have terminal-level bells, desktop notifications, or background workflows.

### Pruning-oriented summary
Keep this if you want a simple “Pi is done” notification and your terminal supports it.
Prune it if you never notice the notifications or they are noisy / unsupported in your terminal.

---

## 4) `pi-extensions/protected-paths.ts`

### What it does
This extension blocks dangerous writes.

It listens to `tool_call`, and if the tool is `write` or `edit`, it checks the requested path against a hard-coded protected list:

- `.env`
- `.git/`
- `node_modules/`

If the path matches one of those substrings, it:
- optionally shows a warning notification,
- and returns `{ block: true, reason: ... }`.

### Matching behavior
The protection is very simple:

```ts
const isProtected = protectedPaths.some((p) => path.includes(p));
```

So it is doing **substring matching**, not normalized path checking.

### Why it may work well
- Very easy to understand.
- Very little can go wrong in the logic itself.
- Useful if you want a lightweight guardrail against accidental edits to sensitive places.

### Why it might feel broken or not worth keeping
- The matching is intentionally crude.
  - It may block paths you did not intend, such as files whose names merely include `.env`.
  - It may miss paths if separators differ from the expected format.
- It only checks `event.input.path` directly and does not normalize the path first.
- It only covers three patterns. If your real concern is broader, this may provide false confidence.

### Pruning-oriented summary
Keep this if you want a simple “cheap safety rail.”
Prune it if you need precise path protection or if the hard-coded rules are not aligned with your actual workflow.

---

## 5) `pi-extensions/status-line.ts`

### What it does
This is a **status-line demo extension**.

It uses `ctx.ui.setStatus()` to place persistent footer text in the UI.

Behavior:
- on `session_start` → sets `Ready`
- on `turn_start` → increments a local `turnCount` and shows `● Turn N...`
- on `turn_end` → shows `✓ Turn N complete`
- on `session_switch` with reason `new` → resets the counter and status to `Ready`

The status key is hard-coded as:
- `status-demo`

### Why it may work well
- The logic is extremely simple.
- If `ctx.ui.setStatus()` is supported in your UI, this should visibly do what the comment says.

### Why it might feel broken or not worth keeping
- It looks like a **demo/example**, not a polished feature.
- It does not restore a historical turn count when you resume an existing session; it just uses an in-memory counter.
- It only resets on `session_switch` when the reason is `new`, so some session transitions may leave the count feeling arbitrary.
- It assumes UI access and does not guard with `ctx.hasUI`.

### Pruning-oriented summary
If you want a tiny visual indicator and like the footer, keep it.
If you are pruning aggressively, this is a strong prune candidate because it reads like demonstration code rather than essential workflow support.

---

## 6) `pi-extensions/todo.ts`

### What it does
This extension adds a **todo tool for the model** and a `/todos` command for you.

The core design is interesting:
- todo state is stored in **tool result details** in the session history,
- not in an external file.

That means branching works naturally: when you view a different branch, the todo list reconstructs to match that branch’s history.

### Registered pieces

#### Tool: `todo`
Supported actions:
- `list`
- `add`
- `toggle`
- `clear`

Tool behavior:
- `list` → returns all current todos
- `add` → appends a new todo with incrementing ID
- `toggle` → flips a todo’s `done` state by ID
- `clear` → wipes the list and resets IDs

Every tool result includes structured `details` containing:
- current todos snapshot
- next ID
- action name
- optional error

That is what makes replay/reconstruction possible.

#### Command: `/todos`
This opens a custom UI component showing the current branch’s todo list.
It supports closing with:
- `Escape`
- `Ctrl+C`

### How state is restored
The extension keeps in-memory state (`todos`, `nextId`) but reconstructs it from the current branch by scanning message entries and replaying tool result details.

It reconstructs on:
- `session_start`
- `session_switch`
- `session_fork`
- `session_tree`

### UI rendering
The tool also custom-renders:
- the tool call (`todo add`, `todo toggle`, etc.)
- the tool result (list output, added item, cleared state)

So it is not just functional; it is trying to look nice in the UI.

### Why it may work well
- The branch-aware state model is clever and well suited to Pi’s session tree model.
- It avoids external files, so todo state naturally follows conversation history.
- The UI work is more complete than a minimal example.

### Why it might feel broken or not worth keeping
- It may be **redundant** if you already have another todo workflow you prefer.
- It depends on session history containing the expected `toolResult` entries for the `todo` tool.
- Like a few other examples, it assumes UI interaction in places where it is not especially defensive.
- It is still fundamentally an example/demo-style extension, just a more useful one than `status-line.ts`.

### Pruning-oriented summary
Keep this if you like having a branch-aware todo list inside Pi itself.
Prune it if it duplicates other task-tracking habits or if you never actually use `/todos`.

---

## Overall recommendation set

### Strong keep candidates if the feature matches your workflow
- `learn-stuff-2.ts` — if you actively want lessons capture and `AGENTS.md` persistence
- `notify.ts` — if terminal notifications work in your environment
- `protected-paths.ts` — if you want a low-friction safety net

### “Keep only if you really use it” candidates
- `loop.ts` — powerful, but intrusive and more failure-prone than the others
- `todo.ts` — useful if you want in-session todos, otherwise optional

### Strong prune candidate if you want a lean setup
- `status-line.ts` — reads like demonstration code rather than core functionality

---

## Fastest litmus tests if you want to validate manually

- `learn-stuff-2.ts`
  - Make a small edit through Pi.
  - Ensure the assistant response includes a `★ Lessons` block.
  - Check whether an `AGENTS.md` file was updated.

- `loop.ts`
  - Run `/loop tests` on a small repo.
  - Confirm that a loop widget appears and that the agent eventually calls `signal_loop_success`.

- `notify.ts`
  - Trigger any normal turn completion.
  - Confirm whether your terminal or desktop shows a notification.

- `protected-paths.ts`
  - Try to edit `.env` through Pi.
  - Confirm the tool call is blocked.

- `status-line.ts`
  - Start a session and do one turn.
  - Confirm the footer changes from `Ready` to `Turn ...` and then to `Turn ... complete`.

- `todo.ts`
  - Ask Pi to use the `todo` tool to add two items.
  - Run `/todos` and confirm they appear.
  - Fork the session and verify the state tracks the branch.
