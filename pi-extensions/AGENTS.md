## Lessons

### Extension Development Patterns

- Extension discovery paths: `~/.pi/agent/extensions`, `.pi/extensions`, and explicit `-e` paths — deleting one is not sufficient proof an extension is unloaded.
- `registerShortcut()` handlers have narrower context than slash commands; session mutation belongs to command context. Use `pi.sendUserMessage()` or editor prefill to bridge.
- When two extensions need specific ordering on `agent_end`, don't rely on filesystem discovery order. Enforce sequencing explicitly.
- `/reload` is often required before behavior changes show up in a running Pi session.

### Code Quality

- Prompt-only formatting is fragile for UI contracts; structured parse + renderer gives predictable output.
- Value imports from `@mariozechner/pi-coding-agent` can break standalone repo tests; type-only imports plus local runtime helpers are safer.
- Co-locating tests under the extension folder makes package moves easier because imports become local and obvious.
- jj split` is a good way to extract a clean task commit while keeping unrelated working-copy changes intact.

### Pi Session Primitives

- Session UX maps cleanly to pi's primitives: `fork(entryId)` is intra-session; `switchSession(sessionFile)` is cross-session.
- For prompt-history: global search returns prompts from many sessions, but `ctx.fork(entryId)` only understands the active session tree.

- This debugging context is ephemeral.
- ⭐ Extension discovery paths: ~/.pi/agent/extensions, .pi/extensions

- Small pure helpers are the safest simplify step after a behavior change because they reduce repetition without moving the contract
- Shared repo-relative path parsing is easier to reason about than repeating `relative(...)/split(...)` logic in multiple target-selection helpers
- When exclusion logic expands from one directory to two, add one regression test per excluded sibling so the rule stays explicit

- Single-use helpers introduced during a first refactor are often the best candidates for a second simplify pass
- Test helpers are highest-value when they collapse repeated structure but keep each assertion’s intent visible
- A safe simplify pass should preserve the same behavioral checkpoints: here, marker-based persistence and excluded target directories

- Sentinel strings are often both UX text and control-flow guards, so renaming them requires updating tests and idempotence checks together
- Internal tag/ref names should track the surviving feature name; otherwise old terminology lingers in maintenance breadcrumbs
- Focused grep + focused tests is a strong validation pattern for small naming migrations

- Canonical naming plus a temporary alias is often the safest way to finish a rename without breaking callers
- When two parsers walk the same heading structure, extracting the boundary scan into one helper reduces drift risk
- Comment drift matters: once persistence became selective, the header should say so explicitly to match the actual behavior

- Compatibility aliases should be temporary; once there are no callers, they’re just extra maintenance surface
- A quick repo-wide grep is often the right proof step before deleting an old symbol name
- Dead exports are a high-signal simplify target because removing them reduces confusion without changing runtime behavior
