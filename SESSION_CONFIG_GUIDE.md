# Configuring Subagent Sessions

**Goal:** Always create subagent sessions in `~/.pi/agent/sessions/subagent/` for ccusage-pi tracking.

## Problem

pi-subagents uses `--no-session` by default. Sessions aren't written unless you pass `sessionDir` in every call.

## Solutions

### Solution 1: Use Helper Functions (Recommended)

Import helpers that automatically add `sessionDir`:

```typescript
import { runChain, runAgent, runParallel } from "./utils/subagent-helpers";

// All calls automatically include sessionDir
runChain("scout-and-plan", "Implement feature X", ".agents/plans/my-work");
runAgent("scout", "Analyze codebase");
runParallel([{ agent: "scout", task: "Task 1" }, { agent: "researcher", task: "Task 2" }]);
```

**Pros:** No repetition, works for all calls, TypeScript support
**Cons:** Requires using helper functions

See `utils/README.md` for full documentation.

---

### Solution 2: Add sessionDir to Chain Calls

Manually add `sessionDir` to each chain call:

```typescript
{
  chain: "scout-and-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/my-work",
  sessionDir: "~/.pi/agent/sessions/subagent"  // ← Add this
}
```

**Pros:** Simple, no dependencies
**Cons:** Easy to forget, doesn't work for single agents

---

### Solution 3: Modify Extension (Permanent Default)

Add config file support to pi-subagents for default `sessionDir`.

**Create `~/.pi/agent/extensions/subagent/config.json`:**
```json
{
  "defaultSessionDir": "~/src/github/vedang/agents/.agents/sessions/subagent"
}
```

**Modify `index.ts` to load config:**
```typescript
interface ExtensionConfig { defaultSessionDir?: string; }

function loadExtensionConfig(): ExtensionConfig {
  const configPath = path.join(os.homedir(), ".pi", "agent", "extensions", "subagent", "config.json");
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch { return {}; }
}

const extensionConfig = loadExtensionConfig();
```

**Update sessionDir resolution:**
```typescript
const defaultSessionDir = extensionConfig.defaultSessionDir
  ? path.resolve(extensionConfig.defaultSessionDir)
  : undefined;
const sessionEnabled = shareEnabled || Boolean(params.sessionDir) || Boolean(defaultSessionDir);
const sessionRoot = sessionEnabled
  ? params.sessionDir
    ? path.resolve(params.sessionDir)
    : defaultSessionDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-session-"))
  : undefined;
```

**Pros:** Permanent default, works automatically
**Cons:** Requires modifying extension, changes lost on updates

---

### Solution 4: Shell Alias

Add to `~/.bashrc` or `~/.zshrc`:

```bash
pi-subagent() {
  pi "$*" sessionDir:'~/.pi/agent/sessions/subagent'
}
```

**Pros:** Works from shell
**Cons:** Fragile, doesn't work within pi

---

## Verification

```bash
# Run a subagent call
# Check sessions were created
ls -la ~/.pi/agent/sessions/subagent/run-0/

# Verify with ccusage-pi
ccusage pi daily --pi-path ~/.pi/agent/sessions/subagent
```

## Session Structure

```
~/.pi/agent/sessions/subagent/
├── run-0/session-*.jsonl
├── run-1/session-*.jsonl
└── async-{id}/session-*.jsonl
```

## Recommendation

**Start with Solution 1** (helper functions) - easiest and most reliable.

**Consider Solution 3** if you want permanent defaults and don't mind maintaining extension modifications.