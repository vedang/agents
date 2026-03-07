## Lessons

- When porting Claude SessionStart `additionalContext` hooks to pi, use a `before_agent_start` extension that appends equivalent guidance to `event.systemPrompt`.
- When users report "auto-compaction failed" around learn-stuff follow-ups, verify session JSONL for `auto_compaction_end`/`compaction` events before changing hook logic; missing failure signals usually indicate output-ordering UX issues, not compaction engine errors.
- When two extensions need a specific order on `agent_end`, do not rely on filesystem discovery order. Enforce sequencing explicitly (for example, through an event bus or follow-up trigger) and guard against extension-triggered recursion.
- When an extension appears to trigger "even after deleting extensions", verify all extension discovery paths and links (`~/.pi/agent/extensions`, `.pi/extensions`, and explicit `-e` paths); deleting one directory or symlink target is not sufficient proof that the extension is unloaded.
- Prompt-only formatting is fragile for UI contracts; structured parse + renderer gives predictable output.
- For LLM output parsing, graceful fallback paths are important to preserve user-visible results.
- Small parsing helpers can significantly improve readability in env-driven config code without changing semantics.
- Shared test fixtures reduce duplication and make future behavior changes easier to update consistently.
- Documentation should be end-user focused: emphasize commands and configuration rather than implementation details
  - Extension READMEs benefit from showing environment variables in a table format for quick reference
  - For tools/commands, including keyboard shortcuts (like quizme's navigation controls) makes the documentation immediately useful
- Separate state from behavior: Extensions should track state (what changed) while prompt templates define behavior (what to do)
- Natural language beats opaque tokens: Using descriptive messages like "The following code paths have changed:" instead of "agent_end" reduces confusion
- Make commands discoverable: Prompt templates in `prompts/` are visible and editable; extension-registered commands are hidden

- Removing unused fields from helper return types can simplify both production code and tests without changing behavior.
- Local integration types should model only the fields the code actually reads; over-declared shapes increase maintenance cost.
- jj split` is a good way to extract a clean task commit while keeping unrelated working-copy changes intact.

- For Pi extension loading, directory structure can be just as important as code correctness.
- Co-locating tests under the extension folder makes package moves easier because imports become local and obvious.
- Pure layout migrations are best kept in their own commit, separate from behavior changes and unrelated working-copy edits.

- When a block mostly builds derived text, extracting it into a pure helper often gives the best simplification payoff.
- Putting pure formatting helpers in `core.ts` avoids pulling test code through runtime-only Pi dependencies.
- A good simplify pass makes orchestration code read as steps, not as a long sequence of mutable local-state updates.

- When a function only handles a fixed small number of cases, specialized branching is often clearer than a generic collection-based approach.
- Mode resolution code is easier to reason about when “invalid input fallback” happens once up front.
- Simplification is highest-value when it preserves behavior while deleting state, loops, or bookkeeping structures.

- Named decision helpers are often the best way to simplify lifecycle-heavy code without changing behavior.
- Regression tests are easier to maintain when scenario constants replace repeated magic values.
- A simplify pass is highest-value when it keeps the fix intact and only reduces branching/duplication.

- Config precedence needs per-layer validation; validating only after merge can let bad high-priority values wipe out good lower-priority ones.
- Session UX maps cleanly to pi’s primitives: use `fork(entryId)` for “resume from here” and `switchSession(sessionFile)` for “restore everything.”
- When adding alternate key actions, help text and dialog labels need to stay synchronized or the UX quickly becomes confusing.

- The cleanest simplifications came from centralizing repeated fallback and movement logic, not from compressing code into fewer lines.
- Deriving selector behavior solely from `primaryAction` is simpler than supporting both `primaryAction` and injected keybinding mappings.
- Safe simplification should always end with the same full quality gates as feature work, because duplicated logic often hides edge-case regressions.

- Value imports from `@mariozechner/pi-coding-agent` can break standalone repo tests; type-only imports plus local runtime helpers are safer here.
- A terminal-sensitive shortcut is easiest to maintain when the secondary key lives in one shared mapping constant.
- For prompt-history UX, “copy” now has a clear contract: replace editor contents and sync the system clipboard together.

- Function keys are a safer fallback than modified `Enter` for terminal-based overlays.
- Centralizing action-key mapping makes late UX changes like `Ctrl+Enter` → `F2` very cheap.
- Prompt-history’s swapped primary/secondary model still reads cleanly when the secondary key is action-neutral.

- Extension runtime types can be stricter than real runtime objects, so optional capability checks are safer at API boundaries.
- A good regression test should mirror the real crash shape exactly; here, omitting `waitForIdle` caught the issue immediately.
- Crash-only fixes are best kept surgical: guard the missing method, keep the rest of the resume flow unchanged.

- registerShortcut()` handlers run with a narrower context than slash commands, so session-mutating actions often need a command handoff.
- Queueing an internal slash command via `pi.sendUserMessage()` is a clean way to bridge from UI-only shortcut contexts to full command contexts.
- Capability checks fix crashes, but API-surface mismatches often need a routing change, not just another `typeof fn === "function"` guard.

- Centralizing repeated identifiers is often the safest simplify step after a bug fix because it reduces drift without touching control flow.
- Replacing repeated inline intersection types with a named alias makes capability-boundary code easier to read and maintain.
- In regression tests, removing empty scaffolding constructors improves signal without hiding scenario intent.

- Extension command handoffs are more reliable when they always use the same queued follow-up path instead of branching on runtime idleness.
- If a slash command appears in the chat transcript, that usually means the extension routed text to the model instead of back into Pi’s command processor.
- Simplification can come directly from a bug fix: removing an “optimization” branch often makes the runtime behavior more correct and easier to reason about.

- Pi shortcut handlers and slash-command handlers have materially different capabilities; session mutation belongs to command context.
- When command injection via `sendUserMessage(...)` is unreliable, prefilling the editor and letting the user press Enter is a safer integration path.
- For extension changes in a running Pi session, `/reload` is often required before behavior changes show up in live testing.

- After a workaround is replaced, the highest-value simplify step is often deleting the no-longer-used plumbing around it.
- Function signatures are a great place to look for accidental complexity after debugging iterations.
- Test doubles should model the current design, not preserve mocks for abandoned code paths.

- prompt-history` global search returns prompts from many sessions, but `ctx.fork(entryId)` only understands the active session tree.
- switchSession(sessionFile)` is the cross-session primitive; `fork(entryId)` is the intra-session primitive.
- Restricting global overlay actions to restore-only would align the UI with Pi’s actual session model and avoid a hidden two-step resume flow.

- fork(entryId)` is a session-local operation, so making global resume restore-only is cleaner than emulating cross-session fork behavior.
- When one feature has two execution paths, the regression tests should cover both; otherwise fallback behavior can drift from the main flow.
- Scope-aware behavior belongs in the command/resume layer, not in the selector rendering layer.

- In test files, extracting repeated decoding and inert stubs is usually the cleanest simplify win.
- A simplify pass should preserve scenario readability; broad test harnesses can make behavior harder to see.
- Progress logs often benefit more from preservation than compression when they’re already concise.

- Prompt-history needed to model session relationship explicitly; search scope alone was not enough to drive correct resume/fork behavior.
- Cross-session fork in Pi is correctly implemented as a composed operation: resume the owning session first, then fork within that session tree.
- Making session relation visible in the overlay improved both correctness and user mental model at the same time.

- Strong visual grouping needs a matching navigation model; grouped rendering without grouped selection order creates a confusing UI.
- The right abstraction for prompt-history overlay sections is a three-way session group (`current-session`, `same-cwd`, `other-cwd`), not a binary current/other split.
- The internal `/prompt-history-resume <encoded>` helper remains necessary because shortcut contexts still cannot call `switchSession()` and `fork()` directly.

- Once results are already normalized into grouped order, regrouping the full list during render is unnecessary; grouping the visible slice is simpler and preserves the same UX.
- Small union-based UI helpers like session-group labels and colors are clearer as typed lookup tables than repeated switches.
- Shared resource-lifecycle helpers like `withPromptHistoryDb(...)` reduce repetition in command handlers without disturbing tested behavior.
