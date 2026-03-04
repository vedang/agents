/**
 * Helper functions for calling subagents with session tracking enabled.
 *
 * These helpers automatically add sessionDir to ensure subagent sessions
 * are written to ~/.pi/agent/sessions/subagent/ for tracking with ccusage-pi.
 *
 * Usage:
 *   import { runChain, runAgent, runParallel } from './utils/subagent-helpers';
 *
 *   runChain("scout-and-plan", "Implement feature X", ".agents/plans/my-work");
 *   runAgent("scout", "Analyze codebase");
 */

/**
 * Default directory for subagent session files.
 * Change this if you want sessions in a different location.
 */
export const SUBAGENT_SESSION_DIR = "~/.pi/agent/sessions/subagent";

/**
 * Run a chain with session tracking enabled.
 *
 * @param chainName - Name of the chain to run
 * @param task - Task to execute (will be available as {task} variable)
 * @param chainDir - Optional directory for chain artifacts (plan.md, context.md, etc.)
 * @param options - Additional options to pass to subagent
 *
 * @example
 * runChain("scout-and-plan", "Implement auth", ".agents/plans/auth-fix");
 */
export function runChain(
  chainName: string,
  task: string,
  chainDir?: string,
  options?: Record<string, unknown>
) {
  return {
    subagent: {
      chain: chainName,
      task,
      chainDir,
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}

/**
 * Run a single agent with session tracking enabled.
 *
 * @param agentName - Name of the agent to run
 * @param task - Task to execute
 * @param options - Additional options (cwd, model, output, reads, etc.)
 *
 * @example
 * runAgent("scout", "Analyze the codebase");
 * runAgent("scout", "Analyze the codebase", { cwd: "/path/to/project" });
 */
export function runAgent(
  agentName: string,
  task: string,
  options?: Record<string, unknown>
) {
  return {
    subagent: {
      agent: agentName,
      task,
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}

/**
 * Run multiple agents in parallel with session tracking enabled.
 *
 * @param tasks - Array of {agent, task, options} objects
 * @param options - Additional options (concurrency, failFast, etc.)
 *
 * @example
 * runParallel([
 *   { agent: "scout", task: "Find API routes" },
 *   { agent: "researcher", task: "Research best practices" }
 * ], { concurrency: 2 });
 */
export function runParallel(
  tasks: Array<{ agent: string; task: string; options?: Record<string, unknown> }>,
  options?: Record<string, unknown>
) {
  return {
    subagent: {
      tasks: tasks.map((t) => ({
        agent: t.agent,
        task: t.task,
        sessionDir: SUBAGENT_SESSION_DIR,
        ...t.options,
      })),
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}

/**
 * Run a custom chain with session tracking enabled.
 *
 * @param steps - Array of chain steps (sequential or parallel)
 * @param task - Original task (available as {task} variable)
 * @param options - Additional options (chainDir, chainSkills, etc.)
 *
 * @example
 * runCustomChain([
 *   { agent: "scout", task: "Analyze {task}" },
 *   { agent: "planner", reads: "context.md" }
 * ], "Implement feature X");
 */
export function runCustomChain(
  steps: Array<Record<string, unknown>>,
  task: string,
  options?: Record<string, unknown>
) {
  return {
    subagent: {
      chain: steps,
      task,
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}

/**
 * Configure the default session directory.
 *
 * @param dir - New default session directory
 *
 * @example
 * setSessionDir("~/.pi/agent/sessions/my-subagents");
 */
export function setSessionDir(dir: string): void {
  // @ts-expect-error - This modifies the exported constant
  SUBAGENT_SESSION_DIR = dir;
}

/**
 * Get the current default session directory.
 *
 * @returns Current session directory
 */
export function getSessionDir(): string {
  return SUBAGENT_SESSION_DIR;
}

/**
 * Type definitions for subagent options (for TypeScript autocomplete).
 */
export interface SubagentOptions {
  cwd?: string;
  model?: string;
  output?: string | false;
  reads?: string[] | false;
  progress?: boolean;
  skill?: string | string[] | boolean;
  chainDir?: string;
  chainSkills?: string[];
  clarify?: boolean;
  includeProgress?: boolean;
  artifacts?: boolean;
}

export interface ChainStepOptions extends SubagentOptions {
  agent: string;
  task?: string;
}

export interface ParallelStepOptions extends SubagentOptions {
  agent: string;
  task?: string;
}

/**
 * Run a chain with full TypeScript typing.
 *
 * @param chainName - Name of the chain
 * @param task - Task to execute
 * @param chainDir - Optional chain directory
 * @param options - Additional typed options
 */
export function runChainTyped(
  chainName: string,
  task: string,
  chainDir?: string,
  options?: SubagentOptions
) {
  return {
    subagent: {
      chain: chainName,
      task,
      chainDir,
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}

/**
 * Run a single agent with full TypeScript typing.
 *
 * @param agentName - Name of the agent
 * @param task - Task to execute
 * @param options - Additional typed options
 */
export function runAgentTyped(
  agentName: string,
  task: string,
  options?: SubagentOptions
) {
  return {
    subagent: {
      agent: agentName,
      task,
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}