# Configuring Subagent Sessions to Always Create in ~/.pi/agent/sessions/subagent/

## The Problem

The pi-subagents extension uses `--no-session` by default, meaning subagent sessions are not written to disk. You want to always create sessions in `~/.pi/agent/sessions/subagent/` for tracking with ccusage-pi.

## Current State

**How sessions work:**
- Default: `--no-session` (no session files created)
- With `sessionDir`: Uses `--session-dir {path}` to create sessions
- Session files go to: `{sessionRoot}/run-{index}/session-*.jsonl`

**Key limitation:** The extension doesn't support a config file to set default `sessionDir`. You must pass it in every call.

## Solutions

### Solution 1: Update Chain Files (Recommended for Chains)

Add `sessionDir` parameter to your chain definitions. This is the cleanest approach for chain-based workflows.

**Update your chain files:**

```markdown
---
name: scout-and-plan
description: Gather context then create and review an implementation plan
---

## scout
output: context.md

Analyze the codebase for {task}

## planner
reads: context.md
output: plan.md
progress: true

Create an implementation plan based on {previous}

## plan-reviewer
reads: plan.md
progress: true

Review the implementation plan from {previous}
```

**When calling the chain, add sessionDir:**

```typescript
{
  chain: "scout-and-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/my-work",
  sessionDir: "~/.pi/agent/sessions/subagent"  // ← Add this
}
```

**Pros:**
- Works with all chain-based workflows
- Clean separation: main session in `~/.pi/agent/sessions/`, subagent sessions in `~/.pi/agent/sessions/subagent/`
- Easy to enable/disable per chain call

**Cons:**
- Must remember to add `sessionDir` to each chain call
- Doesn't help with single agent calls

---

### Solution 2: Create Agent Wrappers with sessionDir

Create wrapper agents that always include `sessionDir`. This is useful for single agent calls.

**Create `agents/scout-with-session.md`:**

```markdown
---
name: scout-with-session
description: Fast codebase recon (always creates session)
model: zai-custom/zai-glm-4.7
temperature: 0.9
top_p: 0.95
clear_thinking: false
tools: read, grep, find, ls, bash, write
output: context.md
---

You are a scout. [rest of scout prompt...]

IMPORTANT: When this agent is called, the subagent extension will automatically
create a session in ~/.pi/agent/sessions/subagent/ via the sessionDir parameter.
```

**Create a helper script or function to call with sessionDir:**

**Option A: TypeScript helper**

```typescript
// helpers/subagent.ts
import { subagent } from "pi";

export function subagentWithSession(config: any) {
  return subagent({
    ...config,
    sessionDir: "~/.pi/agent/sessions/subagent",
  });
}

// Usage:
subagentWithSession({
  agent: "scout",
  task: "Analyze codebase",
});
```

**Option B: Bash alias/function**

```bash
# Add to ~/.bashrc or ~/.zshrc
pi-subagent() {
  pi "subagent({$@, sessionDir:'~/.pi/agent/sessions/subagent'})"
}

# Usage:
pi-subagent agent:'scout' task:'Analyze codebase'
```

**Pros:**
- Works for any subagent call
- Can be used with single agents or chains
- Encapsulates the sessionDir parameter

**Cons:**
- Requires creating wrapper functions
- Adds an extra layer of abstraction

---

### Solution 3: Modify the Extension (Best for Permanent Default)

Modify the pi-subagents extension to support a default sessionDir configuration. This requires editing the extension source code.

**Step 1: Create a config file**

Create `~/.pi/agent/extensions/subagent/config.json`:

```json
{
  "defaultSessionDir": "~/.pi/agent/sessions/subagent"
}
```

**Step 2: Add config loading to index.ts**

Add this near the top of `index.ts`:

```typescript
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// Add after existing imports
interface ExtensionConfig {
  defaultSessionDir?: string;
}

function loadExtensionConfig(): ExtensionConfig {
  const configPath = path.join(os.homedir(), ".pi", "agent", "extensions", "subagent", "config.json");
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

const extensionConfig = loadExtensionConfig();
```

**Step 3: Modify sessionDir resolution in index.ts**

Find this section (around line 300-310):

```typescript
const runId = randomUUID().slice(0, 8);
const shareEnabled = params.share === true;
const sessionEnabled = shareEnabled || Boolean(params.sessionDir);
const sessionRoot = sessionEnabled
  ? params.sessionDir
    ? path.resolve(params.sessionDir)
    : fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-session-"))
  : undefined;
```

Change it to:

```typescript
const runId = randomUUID().slice(0, 8);
const shareEnabled = params.share === true;
const defaultSessionDir = extensionConfig.defaultSessionDir
  ? path.resolve(extensionConfig.defaultSessionDir)
  : undefined;
const sessionEnabled = shareEnabled || Boolean(params.sessionDir) || Boolean(defaultSessionDir);
const sessionRoot = sessionEnabled
  ? params.sessionDir
    ? path.resolve(params.sessionDir)
    : defaultSessionDir
      ? defaultSessionDir
      : fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-session-"))
  : undefined;
```

**Pros:**
- Permanent default, no need to remember to add sessionDir
- Works for all subagent calls automatically
- Can be overridden per-call if needed
- Clean configuration via JSON file

**Cons:**
- Requires modifying extension source code
- Changes will be lost when extension is updated
- Need to re-apply changes after updates

**Step 4: Install the modified extension**

```bash
cd ~/src/github/nicobailon/pi-subagents
npm run build  # or whatever build command it uses
npm link       # or npm install -g .
```

---

### Solution 4: Shell Environment Variable Wrapper

Create a shell function that intercepts pi calls and adds sessionDir.

**Add to ~/.bashrc or ~/.zshrc:**

```bash
# Function to call subagent with sessionDir
subagent() {
  # Check if this looks like a subagent call
  if echo "$*" | grep -q "subagent"; then
    # Add sessionDir to the call
    pi "$*" sessionDir:'~/.pi/agent/sessions/subagent'
  else
    # Pass through unchanged
    pi "$*"
  fi
}

# Alias pi to use the function
alias pi='subagent'
```

**Pros:**
- Works for all pi calls
- No modification to extension needed
- Easy to enable/disable

**Cons:**
- Fragile - parsing command-line arguments is error-prone
- May interfere with other pi functionality
- Doesn't work from within pi itself (only from shell)

---

## Recommended Approach

### For Chain-Based Workflows (Most Common)

**Use Solution 1 with Solution 2 combination:**

1. **Update chain files** to document that `sessionDir` should be used
2. **Create a helper function** for common patterns

**Example: Create a TypeScript helper in your project:**

```typescript
// utils/subagent.ts
import { subagent } from "pi";

const SUBAGENT_SESSION_DIR = "~/.pi/agent/sessions/subagent";

export function runChain(chainName: string, task: string, chainDir?: string) {
  return subagent({
    chain: chainName,
    task,
    chainDir,
    sessionDir: SUBAGENT_SESSION_DIR,
  });
}

export function runAgent(agent: string, task: string, options?: any) {
  return subagent({
    agent,
    task,
    sessionDir: SUBAGENT_SESSION_DIR,
    ...options,
  });
}

// Usage:
runChain("scout-and-plan", "Implement feature X", ".agents/plans/my-work");
runAgent("scout", "Analyze codebase");
```

### For Maximum Convenience

**Use Solution 3 (Modify Extension):**

If you're comfortable modifying the extension and can re-apply changes after updates, this is the most convenient solution. All subagent calls will automatically create sessions without any code changes.

---

## Verifying It Works

After implementing one of the solutions:

1. **Run a subagent call:**
   ```typescript
   {
     agent: "scout",
     task: "Test session creation",
     sessionDir: "~/.pi/agent/sessions/subagent"  // if using Solution 1 or 2
   }
   ```

2. **Check that session files were created:**
   ```bash
   ls -la ~/.pi/agent/sessions/subagent/run-0/
   ```

3. **Verify with ccusage-pi:**
   ```bash
   ccusage pi daily --pi-path ~/.pi/agent/sessions/subagent
   ```

## Session Directory Structure

When `sessionDir` is set to `~/.pi/agent/sessions/subagent/`, sessions are organized as:

```
~/.pi/agent/sessions/subagent/
├── run-0/                          # First subagent in chain/call
│   └── session-{timestamp}-{hash}.jsonl
├── run-1/                          # Second subagent in chain/call
│   └── session-{timestamp}-{hash}.jsonl
└── async-{id}/                     # Async subagent runs
    └── session-{timestamp}-{hash}.jsonl
```

This structure allows ccusage-pi to track each subagent separately while keeping them organized.

## Summary Table

| Solution | Works With Chains | Works With Single Agents | Permanent | Modify Extension | Effort |
|----------|------------------|-------------------------|-----------|------------------|---------|
| 1: Chain Files | ✅ | ❌ | ❌ | ❌ | Low |
| 2: Wrappers | ✅ | ✅ | ❌ | ❌ | Medium |
| 3: Modify Extension | ✅ | ✅ | ✅ | ✅ | High |
| 4: Shell Wrapper | ❌ | ✅ | ✅ | ❌ | Low (but fragile) |

**Recommendation:** Start with Solution 1 for chains, add Solution 2 helpers for single agents. If you find yourself forgetting sessionDir often, consider Solution 3.