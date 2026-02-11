## Lessons

- For extension tests in this repo, run `npx tsx --test pi-extensions/__tests__/*.ts pi-extensions/*/__tests__/*.ts pi-extensions/**/__tests__/*.ts` to cover both root-level and nested test directories.
- When porting Claude SessionStart `additionalContext` hooks to pi, use a `before_agent_start` extension that appends equivalent guidance to `event.systemPrompt`.
- When users report "auto-compaction failed" around learn-stuff follow-ups, verify session JSONL for `auto_compaction_end`/`compaction` events before changing hook logic; missing failure signals usually indicate output-ordering UX issues, not compaction engine errors.
- When two extensions need a specific order on `agent_end`, do not rely on filesystem discovery order. Enforce sequencing explicitly (for example, through an event bus or follow-up trigger) and guard against extension-triggered recursion.
- When an extension appears to trigger "even after deleting extensions", verify all extension discovery paths and links (`~/.pi/agent/extensions`, `.pi/extensions`, and explicit `-e` paths); deleting one directory or symlink target is not sufficient proof that the extension is unloaded.
- Prompt-only formatting is fragile for UI contracts; structured parse + renderer gives predictable output.
- For LLM output parsing, graceful fallback paths are important to preserve user-visible results.
- Small parsing helpers can significantly improve readability in env-driven config code without changing semantics.
- Shared test fixtures reduce duplication and make future behavior changes easier to update consistently.
