# Subagent Helpers

Helper functions that automatically enable session tracking for subagent calls.

## Why Use These?

Subagents use `--no-session` by default (no disk writes). These helpers automatically add `sessionDir: "~/.pi/agent/sessions/subagent"` to track usage with ccusage-pi.

## Quick Start

```typescript
import { runChain, runAgent, runParallel, runCustomChain } from "./utils/subagent-helpers";

// All calls automatically include sessionDir
runChain("scout-and-plan", "Implement feature X", ".agents/plans/my-work");
runAgent("scout", "Analyze codebase");
runParallel([{ agent: "scout", task: "Task 1" }, { agent: "researcher", task: "Task 2" }]);
```

## API

### `runChain(chainName, task, chainDir?, options?)`

Run a predefined chain.

```typescript
runChain("scout-and-plan", "Implement feature X", ".agents/plans/my-work", { clarify: true });
```

### `runAgent(agentName, task, options?)`

Run a single agent.

```typescript
runAgent("scout", "Analyze codebase", { cwd: "/path/to/project", model: "anthropic/claude-sonnet-4" });
```

### `runParallel(tasks, options?)`

Run multiple agents concurrently.

```typescript
runParallel([
  { agent: "scout", task: "Task 1" },
  { agent: "researcher", task: "Task 2" },
], { concurrency: 2 });
```

### `runCustomChain(steps, task, options?)`

Run a custom chain.

```typescript
runCustomChain([
  { agent: "scout", task: "Analyze {task}" },
  { agent: "planner", reads: "context.md" },
], "Implement feature X");
```

### `setSessionDir(dir)`

Change default session directory.

```typescript
setSessionDir("~/.pi/agent/sessions/custom-dir");
```

### `getSessionDir()`

Get current session directory.

```typescript
getSessionDir(); // ~/.pi/agent/sessions/subagent
```

## Options

All helpers accept these options:

```typescript
interface Options {
  cwd?: string;              // Working directory
  model?: string;            // Override model
  output?: string | false;   // Output file in chainDir
  reads?: string[] | false;  // Files to read from chainDir
  progress?: boolean;        // Enable progress.md
  skill?: string | string[]; // Skills to inject
  chainDir?: string;         // Chain artifacts directory
  chainSkills?: string[];    // Skills for all chain steps
  clarify?: boolean;         // Show TUI before execution
  includeProgress?: boolean; // Include full progress in result
  artifacts?: boolean;       // Write debug artifacts
}
```

## Examples

**Complete workflow:**
```typescript
runChain("full-workflow", "Implement authentication", ".agents/plans/auth-work");
```

**Custom chain:**
```typescript
runCustomChain([
  { agent: "scout", task: "Find auth code for {task}" },
  { agent: "planner", reads: "context.md", output: "plan.md" },
], "Add JWT authentication", { chainDir: ".agents/plans/jwt" });
```

**With model override:**
```typescript
runAgent("planner", "Create detailed plan", { model: "anthropic/claude-sonnet-4" });
```

## Verification

```bash
# Check sessions were created
ls -la ~/.pi/agent/sessions/subagent/run-0/

# Track usage
ccusage pi daily --pi-path ~/.pi/agent/sessions/subagent
```

## Override Session Tracking

To disable for a specific call:

```typescript
runAgent("scout", "Quick task", { sessionDir: undefined });
```

Or don't use the helper:

```typescript
{ subagent: { agent: "scout", task: "Quick task" } }
```

## Related

- [SESSION_CONFIG_GUIDE.md](../SESSION_CONFIG_GUIDE.md) - Alternative approaches
- [CCUSAGE_ANALYSIS.md](../CCUSAGE_ANALYSIS.md) - Why session tracking matters