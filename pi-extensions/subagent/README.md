# Subagent

Delegate tasks to specialized agents with isolated context windows. Each subagent runs in a separate `pi` process, providing true isolation and parallel execution.

(This extension is taken from the official Pi-mono extensions and then heavily modified for my needs)

## Features

- **Three Execution Modes**: Single, parallel, or chained agent calls
- **Isolated Context**: Each subagent has its own context window
- **Streaming Updates**: Real-time progress and output streaming
- **Agent Discovery**: Supports user (`~/.pi/agent/agents`) and project (`.pi/agents`) agents
- **Model Routing**: Per-agent model and provider configuration
- **Diagnostics**: Detailed failure diagnostics with retry info

## Execution Modes

### Single Mode

Run a single agent with a specific task:

```javascript
{
  agent: "scout",
  task: "Find all TypeScript files in src/"
}
```

### Parallel Mode

Run multiple agents concurrently (max 8 tasks, 4 concurrent):

```javascript
{
  tasks: [
    { agent: "scout", task: "Find all API routes" },
    { agent: "librarian", task: "Research best practices for API design" }
  ]
}
```

### Chain Mode

Run agents sequentially, passing output to the next:

```javascript
{
  chain: [
    { agent: "scout", task: "Find the authentication module" },
    { agent: "worker", task: "Refactor {previous} to use OAuth2" }
  ]
}
```

## Configuration Options

| Parameter              | Type    | Default  | Description                              |
|------------------------|---------|----------|------------------------------------------|
| `agent`                | string  | -        | Agent name (single mode)                 |
| `task`                 | string  | -        | Task description (single mode)           |
| `tasks`                | array   | -        | Array of `{agent, task}` (parallel mode) |
| `chain`                | array   | -        | Array of `{agent, task}` (chain mode)    |
| `agentScope`           | string  | `"user"` | `"user"`, `"project"`, or `"both"`       |
| `confirmProjectAgents` | boolean | `true`   | Prompt before running project agents     |
| `cwd`                  | string  | -        | Working directory override               |

## Agent Configuration

Agents are configured as YAML files in:
- **User agents**: `~/.pi/agent/agents/<name>.md` or `.yaml`
- **Project agents**: `.pi/agents/<name>.md` or `.yaml`

Example agent config:

```yaml
---
provider: openai
model: gpt-4o
tools: read,bash,write
---

You are a specialized agent for X. Do Y.
```

## Environment Variable Passing

Subagent frontmatter knobs are threaded via environment variables:
- Generic: `PI_TEMPERATURE`
- Provider-specific: `PI_<PROVIDER>_TOP_P`, `PI_<PROVIDER>_BASE_URL`, etc.

## Limits

- **Max parallel tasks**: 8
- **Max concurrency**: 4 (parallel mode)
- **Model mismatch detection**: Warns when requested model differs from runtime

## TUI Display

- **Collapsed**: Shows summary with tool calls (last 10 items)
- **Expanded**: Full output with tool calls, markdown, and usage stats
- Press **Ctrl+O** to toggle expansion

## Usage Stats

Each subagent result includes:
- Turn count
- Input/output tokens
- Cache read/write tokens
- Cost (USD)
- Context tokens
- Model used

## Notes

- Project agents require confirmation (unless `confirmProjectAgents: false`)
- Chain mode stops on first failure
- Parallel mode shows running/pending/done status
- System prompts are written to temp files with restricted permissions
