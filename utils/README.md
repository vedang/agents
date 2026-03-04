# Subagent Helpers

Helper functions for calling subagents with session tracking automatically enabled.

## Why Use These Helpers?

By default, the pi-subagents extension uses `--no-session`, meaning subagent sessions are not written to disk. These helpers automatically add `sessionDir: "~/.pi/agent/sessions/subagent"` to every call, ensuring:

1. **Session files are created** for tracking with ccusage-pi
2. **No manual repetition** of the sessionDir parameter
3. **Consistent behavior** across all subagent calls
4. **Easy to override** if needed

## Installation

The helpers are already in your project at `utils/subagent-helpers.ts`.

Import them in your code:

```typescript
import {
  runChain,
  runAgent,
  runParallel,
  runCustomChain,
} from "./utils/subagent-helpers";
```

## Usage

### Running a Chain

```typescript
// Simple chain call
{
  ...runChain("scout-and-plan", "Implement feature X", ".agents/plans/my-work")
}

// With additional options
{
  ...runChain("full-workflow", "Implement auth", ".agents/plans/auth", {
    clarify: false,
    includeProgress: true,
  })
}
```

### Running a Single Agent

```typescript
// Simple agent call
{
  ...runAgent("scout", "Analyze the codebase")
}

// With working directory
{
  ...runAgent("scout", "Analyze the codebase", {
    cwd: "/path/to/project",
  })
}

// With model override
{
  ...runAgent("planner", "Create a plan", {
    model: "anthropic/claude-sonnet-4",
  })
}

// With output file
{
  ...runAgent("scout", "Analyze codebase", {
    output: "context.md",
    cwd: "/path/to/project",
  })
}
```

### Running Parallel Tasks

```typescript
// Multiple agents in parallel
{
  ...runParallel([
    { agent: "scout", task: "Find API routes" },
    { agent: "researcher", task: "Research best practices" },
    { agent: "scout", task: "Find tests" },
  ])
}

// With concurrency limit
{
  ...runParallel([
    { agent: "scout", task: "Task 1" },
    { agent: "planner", task: "Task 2" },
    { agent: "worker", task: "Task 3" },
  ], {
    concurrency: 2,
    failFast: true,
  })
}
```

### Running a Custom Chain

```typescript
// Define your own chain steps
{
  ...runCustomChain([
    { agent: "scout", task: "Analyze {task}" },
    { agent: "planner", reads: "context.md" },
    { agent: "worker", reads: "plan.md" },
  ], "Implement feature X", {
    chainDir: ".agents/plans/custom-work",
  })
}

// With parallel step
{
  ...runCustomChain([
    { agent: "scout", task: "Analyze {task}" },
    {
      parallel: [
        { agent: "researcher", task: "Research X" },
        { agent: "researcher", task: "Research Y" },
      ]
    },
    { agent: "planner", reads: "context.md" },
  ], "Complex task", {
    chainDir: ".agents/plans/complex",
  })
}
```

## Configuration

### Change Default Session Directory

```typescript
import { setSessionDir } from "./utils/subagent-helpers";

// Change to a different directory
setSessionDir("~/.pi/agent/sessions/my-custom-dir");

// All subsequent calls will use the new directory
runAgent("scout", "Test");
```

### Get Current Session Directory

```typescript
import { getSessionDir } from "./utils/subagent-helpers";

console.log(getSessionDir()); // ~/.pi/agent/sessions/subagent
```

## TypeScript Support

For full TypeScript autocomplete, use the typed versions:

```typescript
import {
  runChainTyped,
  runAgentTyped,
  type SubagentOptions,
} from "./utils/subagent-helpers";

// With typed options
{
  ...runAgentTyped("scout", "Analyze codebase", {
    cwd: "/path/to/project",
    model: "anthropic/claude-sonnet-4",
    output: "context.md",
    reads: ["previous-context.md"],
    progress: true,
  })
}
```

## Available Options

All helpers accept these options:

```typescript
interface SubagentOptions {
  cwd?: string;           // Working directory
  model?: string;         // Override model (e.g., "anthropic/claude-sonnet-4")
  output?: string | false; // Output file in chainDir
  reads?: string[] | false; // Files to read from chainDir
  progress?: boolean;     // Enable progress.md tracking
  skill?: string | string[] | boolean; // Skills to inject
  chainDir?: string;      // Chain artifacts directory
  chainSkills?: string[]; // Skills for all chain steps
  clarify?: boolean;      // Show TUI before execution
  includeProgress?: boolean; // Include full progress in result
  artifacts?: boolean;    // Write debug artifacts
}
```

## Examples in Context

### Complete Planning Workflow

```typescript
// Using the helper for a complete workflow
{
  ...runChain("full-workflow", "Implement authentication", ".agents/plans/auth-work", {
    clarify: true,  // Preview before executing
  })
}

// This is equivalent to:
{
  subagent: {
    chain: "full-workflow",
    task: "Implement authentication",
    chainDir: ".agents/plans/auth-work",
    sessionDir: "~/.pi/agent/sessions/subagent",
    clarify: true,
  }
}
```

### Quick Codebase Analysis

```typescript
// Quick analysis without chain
{
  ...runAgent("scout", "Find all authentication-related code", {
    cwd: "/path/to/project",
    output: "auth-context.md",
  })
}
```

### Research + Planning

```typescript
// Research then plan
{
  ...runCustomChain([
    { agent: "researcher", task: "Research JWT best practices for {task}" },
    { agent: "planner", reads: "research.md", output: "plan.md" },
  ], "Implement JWT authentication", {
    chainDir: ".agents/plans/jwt-auth",
  })
}
```

## Verifying Session Files

After using a helper, verify that sessions were created:

```bash
# Check if sessions exist
ls -la ~/.pi/agent/sessions/subagent/run-0/

# View session content
cat ~/.pi/agent/sessions/subagent/run-0/session-*.jsonl | jq '.'

# Track usage with ccusage-pi
ccusage pi daily --pi-path ~/.pi/agent/sessions/subagent
```

## Troubleshooting

### Sessions Not Being Created

1. **Check the directory exists:**
   ```bash
   mkdir -p ~/.pi/agent/sessions/subagent
   ```

2. **Verify the helper is being called:**
   Make sure you're using `...runAgent()` (spread syntax) not just `runAgent()`.

3. **Check pi logs:**
   Look for any errors in pi's output about session directory creation.

### Want to Disable Sessions for a Specific Call

Override the sessionDir:

```typescript
{
  ...runAgent("scout", "Quick task", {
    sessionDir: undefined,  // This will use --no-session
  })
}
```

Or don't use the helper for that specific call:

```typescript
{
  subagent: {
    agent: "scout",
    task: "Quick task",
    // No sessionDir = --no-session
  }
}
```

## Comparison

| Approach | Session Tracking | Code | Effort |
|----------|-----------------|-------|---------|
| Manual `subagent()` | ❌ (unless specified) | Verbose | High |
| Helpers | ✅ (automatic) | Clean | Low |
| Modify extension | ✅ (automatic) | Cleanest | High (initial) |

## Related Documentation

- [SESSION_CONFIG_GUIDE.md](../SESSION_CONFIG_GUIDE.md) - Detailed configuration options
- [CCUSAGE_ANALYSIS.md](../CCUSAGE_ANALYSIS.md) - Why session tracking matters
- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) - Using pi-subagents extension