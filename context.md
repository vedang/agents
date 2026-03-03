`★ Insight ─────────────────────────────────────`
**Session Recording Architecture**: The pi-subagents extension uses a dual-layer approach for session recording:
1. **pi CLI sessions**: Each spawned pi process gets its own session file via `--session-dir`, managed entirely by pi's session system
2. **Extension artifacts**: Separate debug files (input, output, metadata, and optional JSONL) written to `subagent-artifacts/` subdirectories

**Key Design Decision**: Subagents don't write to parent session files. Instead, each subagent run creates an isolated session directory. This prevents pollution of the main session file and allows parallel subagents to have independent session tracking.

**Flag Strategy**: The extension uses conditional flag logic - `--no-session` when disabled, `--session-dir {path}` when enabled. This gives fine-grained control: sessions can be enabled for artifact writing (`sessionDir` set) even when sharing is disabled, or vice versa.
`─────────────────────────────────────────────────`

I've completed my investigation of the pi-subagents extension's session recording mechanism and written the findings to `/Users/nejo/src/github/vedang/agents/context.md`.

## Summary of Findings

### 1. Do subagents use `--session` or `--no-session` flag?
**Yes, subagents use `--no-session` flag.** They do NOT use a `--session` flag. Instead:
- When sessions are **disabled**: Adds `--no-session` to the spawned pi process arguments
- When sessions are **enabled**: Adds `--session-dir {path}` to specify the output directory

**Location**: `execution.ts` lines 70-78, `subagent-runner.ts` lines 250-252

### 2. Where do they write their JSONL output?
**There are TWO separate JSONL outputs:**

a) **Session JSONL** (primary): Written by pi CLI to `{sessionDir}/session-{timestamp}-{hash}.jsonl`
   - This is pi's built-in session file
   - Controlled via `--session-dir` flag passed to pi

b) **Artifact JSONL** (debug, disabled by default): Written to `{artifactsDir}/{runId}_{agent}.jsonl`
   - Controlled by extension's `artifactConfig.includeJsonl`
   - **Default is `false`** (see `types.ts` line 193)

### 3. Do they write to the parent session file or create separate files?
**They create SEPARATE files.** Subagents do NOT write to the parent session file:
- Each subagent run gets its own session directory: `{sessionRoot}/run-{index}/`
- Async runs use: `{sessionRoot}/async-{id}/`
- Artifact files go to a `subagent-artifacts/` subdirectory, completely separate from session files

### 4. Session-related command line arguments or environment variables?
**Command-line arguments:**
- `--no-session`: Disable session recording
- `--session-dir {path}`: Specify session output directory

**Environment variables:**
- **None found** - No session-related environment variables in the codebase

### 5. Is there a `sessionDir` parameter?
**Yes, `sessionDir` is defined:**
- Location: `schemas.ts` lines 86-88
- Type: Optional string
- Description: "Directory to store session logs (default: temp; enables sessions even if share=false)"
- Default: Temp directory (`/tmp/pi-subagent-session-XXXXXX`)

`★ Lessons ─────────────────────────────────────`
- **Dual output separation**: The extension cleanly separates pi's session files from its own debug artifacts, preventing duplication and large file sizes
- **Conditional flag logic**: Using `--no-session` when disabled and `--session-dir` when enabled provides explicit control without needing an explicit `--session` flag
- **Default safety**: JSONL artifacts are disabled by default to prevent disk bloat, as they duplicated pi's own session files
`─────────────────────────────────────────────────`