## Lessons

- For extension tests in this repo, run `npx tsx --test pi-extensions/__tests__/*.ts pi-extensions/*/__tests__/*.ts pi-extensions/**/__tests__/*.ts` to cover both root-level and nested test directories.
- When porting Claude SessionStart `additionalContext` hooks to pi, use a `before_agent_start` extension that appends equivalent guidance to `event.systemPrompt`.
- When users report "auto-compaction failed" around learn-stuff follow-ups, verify session JSONL for `auto_compaction_end`/`compaction` events before changing hook logic; missing failure signals usually indicate output-ordering UX issues, not compaction engine errors.
- When two extensions need a specific order on `agent_end`, do not rely on filesystem discovery order. Enforce sequencing explicitly (for example, through an event bus or follow-up trigger) and guard against extension-triggered recursion.
- For subagent model routing, do not assume `--model` accepts `provider/model` IDs. If an agent frontmatter model is namespaced (for example `cerebras/zai-glm-4.7`), split and pass both `--provider` and provider-local `--model`, and surface runtime `provider`/`model` from JSON events so the UI cannot misreport effective routing.
