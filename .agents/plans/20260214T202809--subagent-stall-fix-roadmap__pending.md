# Plan: Subagent stall fix roadmap

## Context
Session `unravel-astro-tanstack` shows repeated long stalls where turns appear hung:
- `2026-02-14T06:27:19Z` → `2026-02-14T09:56:18Z`: single `subagent` call stalled ~3h29m, then returned `Subagent was aborted`.
- `2026-02-14T09:58:10Z` → `2026-02-14T10:08:32Z`: `subagent` call stalled ~10m22s, then returned `Subagent was aborted`.
- `2026-02-14T10:14:46Z` → `2026-02-14T10:15:23Z`: repeated assistant `fetch failed` errors; no successful continuation after retries.

Primary code paths implicated:
- `~/.pi/agent/extensions/subagent/index.ts` (child `pi` process lifecycle; no execution timeout)
- `~/src/github/badlogic/pi-mono/packages/agent/src/agent-loop.ts` (awaits tool execution without global timeout)
- `~/src/github/badlogic/pi-mono/packages/ai/src/providers/openai-codex-responses.ts` and `openai-completions.ts` (network streams can wait indefinitely without explicit read timeout)

## Goals
1. Prevent indefinite waits in subagent execution and provider streaming.
2. Surface clear progress/timeout diagnostics during long-running turns.
3. Ensure loop workflows fail fast or degrade gracefully instead of appearing frozen.

## Tasks
- [ ] Add configurable subagent execution timeout (`timeoutMs`/`timeoutSeconds`) in `~/.pi/agent/extensions/subagent/index.ts` and enforce hard-stop behavior with robust process termination.
- [ ] Fix abort kill escalation logic in subagent extension to ensure SIGKILL fallback is actually attempted after grace period.
- [ ] Preserve and return diagnostics on aborted/timed-out subagent runs (instead of dropping details via throw-only path).
- [ ] Add heartbeat/progress updates from subagent tool when no `message_end` events are received for N seconds.
- [ ] Add provider-side request/read timeout controls for `openai-codex-responses` and `openai-completions` streaming paths (abortable via signal).
- [ ] Add turn-level watchdog/instrumentation in coding-agent loop to identify the currently blocking phase (LLM stream vs tool execute vs extension event).
- [ ] Improve retry UX for repeated `fetch failed`: emit explicit terminal status with suggested recovery and optional automatic retry budget reset.
- [ ] Add regression tests:
  - subagent timeout + abort diagnostics
  - provider timeout path surfaces `stopReason: error` quickly
  - no-hang behavior in loop mode with failing subagent/provider.
- [ ] Document new timeout/retry knobs in extension README and pi docs.

## Validation plan
- Reproduce with a synthetic hung subagent process and verify timeout termination + diagnostics payload.
- Reproduce with a mocked stalled provider stream and verify read-timeout error handling.
- Run full checks in target repos: `make test`, `make check`, `make format`.

## Risk notes
- Timeout defaults that are too aggressive may interrupt legitimate long-running research tasks.
- Timeout defaults that are too high will not meaningfully improve UX.
- Must keep signal propagation and retry semantics consistent across interactive and print/json modes.
