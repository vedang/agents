/**
 * Helper functions for subagent calls with automatic session tracking.
 *
 * All helpers automatically add `sessionDir: "~/.pi/agent/sessions/subagent"`
 * to ensure subagent sessions are written to disk for ccusage-pi tracking.
 */

export const SUBAGENT_SESSION_DIR = "~/.pi/agent/sessions/subagent";

/** Run a chain with session tracking */
export function runChain(chainName: string, task: string, chainDir?: string, options?: Record<string, unknown>) {
  return { subagent: { chain: chainName, task, chainDir, sessionDir: SUBAGENT_SESSION_DIR, ...options } };
}

/** Run a single agent with session tracking */
export function runAgent(agentName: string, task: string, options?: Record<string, unknown>) {
  return { subagent: { agent: agentName, task, sessionDir: SUBAGENT_SESSION_DIR, ...options } };
}

/** Run multiple agents in parallel with session tracking */
export function runParallel(
  tasks: Array<{ agent: string; task: string; options?: Record<string, unknown> }>,
  options?: Record<string, unknown>
) {
  return {
    subagent: {
      tasks: tasks.map((t) => ({ agent: t.agent, task: t.task, sessionDir: SUBAGENT_SESSION_DIR, ...t.options })),
      sessionDir: SUBAGENT_SESSION_DIR,
      ...options,
    },
  };
}

/** Run a custom chain with session tracking */
export function runCustomChain(steps: Array<Record<string, unknown>>, task: string, options?: Record<string, unknown>) {
  return { subagent: { chain: steps, task, sessionDir: SUBAGENT_SESSION_DIR, ...options } };
}

/** Set a custom default session directory */
export function setSessionDir(dir: string): void {
  // @ts-expect-error - Modifying exported constant
  SUBAGENT_SESSION_DIR = dir;
}

/** Get current session directory */
export function getSessionDir(): string {
  return SUBAGENT_SESSION_DIR;
}