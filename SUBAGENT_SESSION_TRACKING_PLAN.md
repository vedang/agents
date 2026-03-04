# Subagent Session Tracking Investigation & Plan (2026-03-04)

## Scope
Investigated:
1. Whether main Pi session artifacts already contain enough subagent usage/token data.
2. Whether `sessionDir` can be configured without changing the `pi-subagents` codebase.
3. What `ccusage-pi` currently reads, and what needs to change to report subagent usage.

---

## 1) Main session evidence: subagent usage is already present

### Sessions inspected
From:
`~/.pi/agent/sessions/--Users-nejo-src-github-vedang-agents--/`

Latest files sampled:
- `2026-03-04T06-15-23-252Z_15157ffc-452b-40f0-be9d-68eb62bf7a4f.jsonl`
- `2026-03-04T04-30-13-243Z_fc4659f2-eb37-40e3-80de-2111c798552c.jsonl`
- `2026-03-03T16-25-12-566Z_1cfb1b7c-308c-439d-b379-c998a0db6683.jsonl`
- `2026-03-03T14-56-27-148Z_d1fed54b-1413-498e-971b-c2e5d6196c37.jsonl`

### Where the data is
For `toolResult` messages with `message.toolName == "subagent"`, usage is in:
- `message.details.results[].usage.input`
- `message.details.results[].usage.output`
- `message.details.results[].usage.cacheRead`
- `message.details.results[].usage.cacheWrite`
- `message.details.results[].usage.cost`
- `message.details.results[].usage.turns`

Related metadata is also linked from:
- `message.details.artifacts.files[].metadataPath`

Metadata file example:
- `~/.pi/agent/sessions/--Users-nejo-src-github-vedang-agents--/subagent-artifacts/1be81333_scout_meta.json`

This file includes:
- `usage` (input/output/cache/turns)
- `model`
- `durationMs`
- `toolCount`

### Important distinction
The parent assistant message usage (`message.usage`) on a subagent tool-call line is the **main agent's** cost for deciding/invoking tools.
Subagent run usage is separately recorded in `message.details.results[].usage`.

### Quick evidence summary
From latest sampled sessions:
- Subagent calls exist and all sampled calls omitted `sessionDir`.
- Despite that, each subagent tool result includes per-subagent usage in `details.results[].usage`.
- Therefore: **main session JSONL already has enough data for subagent usage accounting**.

---

## 2) `sessionDir` configuration without changing pi-subagents source

## What works today (no extension code changes)
You can pass `sessionDir` directly in each subagent tool call:

```ts
{ agent: "scout", task: "...", sessionDir: "~/.pi/agent/sessions/subagent" }
```

Confirmed in `pi-subagents`:
- Schema includes `sessionDir`:
  - `~/src/github/nicobailon/pi-subagents/schemas.ts`
- Runtime resolves and uses it:
  - `~/src/github/nicobailon/pi-subagents/index.ts`
  - `~/src/github/nicobailon/pi-subagents/execution.ts`

## What does NOT currently work as a global default

### Agent definitions (`agents/*.md`)
Not supported as a tool default mechanism.
Agent frontmatter supports fields like `model`, `tools`, `output`, `defaultReads`, etc., but not a global subagent tool parameter default.

Relevant files:
- `~/src/github/nicobailon/pi-subagents/agents.ts`
- `~/src/github/nicobailon/pi-subagents/agent-serializer.ts`

### `pi-settings.json`
No direct integration found for setting subagent extension runtime defaults like `sessionDir`.

### Extension config default (`~/.pi/agent/extensions/subagent/config.json`)
Config loader exists, but currently only supports:
- `asyncByDefault`

Relevant files:
- `~/src/github/nicobailon/pi-subagents/index.ts`
- `~/src/github/nicobailon/pi-subagents/types.ts` (`ExtensionConfig`)

No built-in `defaultSessionDir` key today.

---

## 3) ccusage-pi current behavior and gap

In `~/src/github/ryoppippi/ccusage/apps/pi/`:

- Parser reads top-level JSONL lines and extracts assistant usage from `message.usage`.
- It does **not** parse nested `message.details.results[].usage` from `toolResult` subagent entries.

Key files:
- `src/_pi-agent.ts`
- `src/data-loader.ts`

Result: subagent token usage is undercounted today.

---

## Recommended implementation plan

### Phase 1 (best immediate ROI): ccusage-pi support for embedded subagent usage

Update `apps/pi` loader to also parse subagent tool-result usage from main sessions:

- Detect entries where:
  - `message.role == "toolResult"`
  - `message.toolName == "subagent"`
- Extract every `message.details.results[].usage`
- Add these as additional usage entries (source-tagged as subagent)
- Avoid double counting by deduping using stable keys:
  - session file path + JSONL line index + result index

Why this first:
- Works with existing historical data.
- No dependency on `sessionDir` adoption.
- No subagent extension changes required.

### Phase 2 (optional but useful): standardize explicit `sessionDir` for raw subagent sessions

For richer forensic/debug workflows, pass `sessionDir` in subagent calls (manual or helper wrappers) to persist child session JSONL files.

### Phase 3 (small extension enhancement): add `defaultSessionDir`

Add support in `pi-subagents` extension config:
- `ExtensionConfig.defaultSessionDir?: string`
- Fallback when call-level `sessionDir` is omitted

This removes per-call repetition and makes adoption reliable.

---

## Suggested acceptance criteria

1. `ccusage pi session` totals increase for sessions that include subagent runs.
2. A fixture with known `details.results[].usage` produces deterministic totals.
3. No regression on sessions without subagent tool results.
4. (Optional) If `sessionDir` is used, subagent JSONL files are created under configured path.

---

## Final conclusion

- **Yes**, main session artifacts already contain sufficient subagent usage/token information for accounting.
- **Yes**, `sessionDir` can be set today without modifying `pi-subagents` source, but only **per call**.
- **No**, there is currently no configuration-only global default via agent definitions or `pi-settings.json`.
- **Best path:** add parsing of `toolResult.details.results[].usage` in `ccusage-pi` first; treat extension-side `defaultSessionDir` as a secondary quality-of-life enhancement.
