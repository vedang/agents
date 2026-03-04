# ccusage Token Tracking Analysis for Subagent Sessions

## Executive Summary

**ccusage-pi does NOT correctly capture subagent token consumption in either the old or new subagent extensions.**

The issue stems from how sessions are recorded: subagents either don't write session files at all, or write them to directories that ccusage-pi doesn't read.

---

## How ccusage-pi Works

### Architecture

ccusage-pi is a **post-hoc analyzer** that:
1. Reads JSONL session files from `~/.pi/agent/sessions/`
2. Parses each line looking for `message_end` events with:
   - `role === 'assistant'`
   - `usage` object with input/output tokens
3. Aggregates usage by date, month, or session ID
4. Generates reports with token counts and costs

### Data Schema

```typescript
// From _pi-agent.ts - what ccusage looks for:
{
  type?: 'message' | undefined,
  timestamp: ISO-8601 string,
  message: {
    role: 'assistant',
    model?: string,
    usage: {
      input: number,
      output: number,
      cacheRead?: number,
      cacheWrite?: number,
      totalTokens?: number,
      cost?: { total?: number }
    }
  }
}
```

### Key Finding: No Subagent Awareness

**ccusage-pi has NO special handling for subagents.** It treats every JSONL line equally as a usage entry. There is no:
- Parent-child relationship tracking
- Depth or hierarchy detection
- Subagent session identification
- Parallel/chaining awareness

---

## Old Subagents Extension

### Session Recording Behavior

**Subagents use `--no-session` flag.**

**Location**: `old-extensions/subagents/index.ts:353`

```typescript
const args = [
  "--mode", "json",
  "-p",
  "--no-session",  // ← Session recording disabled
  "--provider", provider,
  "--model", model,
  // ...
];
```

### Implications for ccusage-pi

❌ **ccusage-pi does NOT capture subagent usage.**

**Reason**: Subagents don't write any session files:
- No `--session` flag used
- No JSONL output to disk
- All output captured in-memory via stdout JSON events
- Extension parses events and returns results to parent

**Result**: Only the main pi session file contains usage data. Subagent token consumption is completely invisible to ccusage-pi.

### Session Flow

```
User Request
    ↓
Main pi process (writes to ~/.pi/agent/sessions/...)
    ↓
Old subagent extension spawns subagent
    ↓
Subagent: pi --mode json --no-session ...
    ↓
Subagent output: JSON events on stdout (NO session file)
    ↓
Extension parses events, returns to parent
    ↓
Main session file: Contains only main process usage
```

---

## New pi-subagents Extension

### Session Recording Behavior

**Subagents use `--no-session` by default, but can enable with `sessionDir` parameter.**

**Location**: `~/src/github/nicobailon/pi-subagents/src/execution.ts:70-78`

```typescript
if (sessionOpts.enabled) {
  args.push("--session-dir", sessionOpts.dir);
} else {
  args.push("--no-session");  // ← Default behavior
}
```

**Location**: `~/src/github/nicobailon/pi-subagents/src/subagent-runner.ts:250-252`

```typescript
if (sessionOpts.enabled) {
  spawnArgs.push("--session-dir", sessionOpts.dir);
} else {
  spawnArgs.push("--no-session");
}
```

### Session Directory Structure

When `sessionDir` is set, subagents write to a **separate directory**:

```
{sessionRoot}/
├── run-0/                          # First subagent run
│   └── session-{timestamp}-{hash}.jsonl
├── run-1/                          # Second subagent run
│   └── session-{timestamp}-{hash}.jsonl
└── async-{id}/                     # Async runs
    └── session-{timestamp}-{hash}.jsonl
```

**Default**: `sessionRoot` = temp directory (`/tmp/pi-subagent-session-XXXXXX`)

**Override**: Via `sessionDir` parameter in tool call

### Implications for ccusage-pi

❌ **ccusage-pi does NOT capture subagent usage by default.**

**Reason**: Default behavior uses `--no-session`, so no session files are created.

❌ **ccusage-pi does NOT capture subagent usage even with `sessionDir` set.**

**Reason**: Even when sessions are enabled:
1. Subagent sessions go to `{sessionRoot}/run-{index}/` or `{sessionRoot}/async-{id}/`
2. ccusage-pi only reads from `~/.pi/agent/sessions/`
3. Directory mismatch means ccusage-pi can't find subagent session files

### Session Flow

```
User Request
    ↓
Main pi process (writes to ~/.pi/agent/sessions/...)
    ↓
New pi-subagents extension spawns subagent
    ↓
Default: pi --no-session ...
  OR
With sessionDir: pi --session-dir /tmp/pi-subagent-session-XXX/run-0 ...
    ↓
Subagent output: JSON events on stdout + optional session file
    ↓
Extension parses events, returns to parent
    ↓
Main session file: Contains only main process usage
Subagent session file: In separate directory (not read by ccusage-pi)
```

---

## Root Cause Analysis

### The Design Conflict

| Aspect              | ccusage-pi Design          | Subagent Extension Design    |
|---------------------|----------------------------|------------------------------|
| Session location    | `~/.pi/agent/sessions/`    | Separate per-run directories |
| Session ownership   | Flat list, no hierarchy    | Isolated per subagent run    |
| Session aggregation | All sessions equal         | Parent and children separate |
| Session discovery   | Glob `sessions/**/*.jsonl` | Configurable per extension   |

### Why Both Extensions Isolate Subagent Sessions

**Design Intent:**
1. **Prevent pollution**: Subagent events shouldn't mix with main session
2. **Parallel execution**: Multiple subagents need independent sessions
3. **Clean separation**: Parent and child concerns should be separate
4. **Debug isolation**: Each subagent's session is self-contained

**Consequence**: This design breaks usage tracking aggregation.

---

## Potential Solutions

### Solution 1: ccusage-pi Add Subagent Support (Recommended)

**Changes needed:**

1. **Discover subagent session directories**
   ```typescript
   // Search in common locations:
   // - /tmp/pi-subagent-session-*/
   // - User-configurable session directories
   ```

2. **Detect parent-child relationships**
   ```typescript
   // Parse session metadata for parent session ID
   // Build hierarchy tree
   ```

3. **Aggregate subagent usage into parent session**
   ```typescript
   // For each main session:
   // - Find all subagent sessions
   // - Sum their usage
   // - Report total usage (main + subagents)
   ```

4. **Optional: Report subagent breakdown**
   ```typescript
   // Show breakdown by subagent:
   // - Total tokens: 1000
   //   - Main process: 300
   //   - Subagent 1 (scout): 200
   //   - Subagent 2 (planner): 500
   ```

**Pros:**
- No changes to subagent extensions
- Retroactive (can analyze historical data)
- Flexible (can handle both extensions)

**Cons:**
- Need to discover session directories
- Need to infer parent-child relationships
- More complex implementation

### Solution 2: Modify New Extension to Write to Standard Location

**Changes needed:**

1. **Add configuration option to write subagent sessions to `~/.pi/agent/sessions/`**
   ```typescript
   interface SubagentOptions {
     writeSessionsToStandardLocation?: boolean;  // New option
   }
   ```

2. **When enabled, use `--session-dir ~/.pi/agent/sessions/...`**
   ```typescript
   if (writeSessionsToStandardLocation) {
     const sessionDir = path.join(homedir(), '.pi', 'agent', 'sessions');
     args.push('--session-dir', sessionDir);
   }
   ```

3. **Add metadata to identify subagent sessions**
   ```typescript
   // Add to session metadata:
   {
     parentSessionId: 'main-session-id',
     subagentIndex: 0,
     agentName: 'scout',
     chainRunId: 'run-id'
   }
   ```

**Pros:**
- ccusage-pi works without changes
- Simple to implement
- Leverages existing ccusage-pi logic

**Cons:**
- Only works for new extension
- Breaks isolation design principle
- May pollute main sessions directory
- Not retroactive

### Solution 3: Hybrid Approach (Best for Long Term)

1. **ccusage-pi adds subagent support** (Solution 1)
2. **New extension adds optional standard location writing** (Solution 2)
3. **ccusage-pi prefers standard location, falls back to discovery**

**Pros:**
- Works for both extensions
- Forward and backward compatible
- Flexible configuration
- Best of both worlds

**Cons:**
- Most complex to implement
- Requires coordination between projects

---

## Immediate Workaround

### Use `sessionDir` with Custom Path + ccusage-pi Path Override

If you want ccusage-pi to capture subagent usage, you can override the path:

**Method 1: Command-line argument**

```bash
# Read main sessions
ccusage pi daily

# Read subagent sessions (if you set sessionDir to custom location)
ccusage pi daily --pi-path /tmp/pi-subagent-session-XXX
```

**Method 2: Environment variable**

```bash
# Set custom path for subagent sessions
export PI_AGENT_DIR=/tmp/pi-subagent-session-XXX

# ccusage-pi will read from that directory
ccusage pi daily
```

**Method 3: Configure subagents to write to standard location**

1. **Set `sessionDir` to a subdirectory of standard sessions:**
   ```typescript
   {
     agent: "scout",
     task: "Analyze codebase",
     sessionDir: "~/.pi/agent/sessions/subagents"
   }
   ```

2. **Read both main and subagent sessions:**
   ```bash
   # Main session usage
   ccusage pi daily

   # Subagent session usage
   ccusage pi daily --pi-path ~/.pi/agent/sessions/subagents
   ```

**Limitations:**
- Manual aggregation required (need to add numbers manually)
- No parent-child relationship tracking
- Separate reports
- Need to know where subagent sessions are stored

---

## Recommendations

### For ccusage-pi Users

1. **Awareness**: Be aware that subagent usage is NOT captured
2. **Workaround**: Use `sessionDir` with custom path if you need to track subagent usage
3. **Feature request**: Request subagent support from ccusage-pi maintainers

### For Subagent Extension Users

1. **Default behavior**: Subagent sessions are isolated (by design)
2. **Enable tracking**: Use `sessionDir` parameter if you need session files
3. **Custom paths**: Use `sessionDir` with standard location for ccusage-pi compatibility

### For Developers

1. **ccusage-pi**: Implement Solution 1 (subagent support)
2. **New extension**: Consider Solution 2 (optional standard location)
3. **Long term**: Aim for Solution 3 (hybrid approach)

---

## Appendix: Code References

### ccusage-pi

- **Schema definition**: `src/_pi-agent.ts:12-30`
- **Data loader**: `src/data-loader.ts:99-160`
- **Session extraction**: `src/_pi-agent.ts:39-43`
- **Project extraction**: `src/_pi-agent.ts:45-57`

### Old Subagents Extension

- **Session flag**: `old-extensions/subagents/index.ts:353`
- **Process spawn**: `old-extensions/subagents/index.ts:390-410`

### New pi-subagents Extension

- **Session flag logic**: `src/execution.ts:70-78`
- **Async runner session**: `src/subagent-runner.ts:250-252`
- **Session dir schema**: `src/schemas.ts:86-88`
- **Session types**: `src/types.ts:140-160`
