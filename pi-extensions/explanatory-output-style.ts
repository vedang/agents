/**
 * Explanatory Output Style Extension
 *
 * Recreates Claude's deprecated explanatory output style session-start hook
 * for pi-coding-agent by appending equivalent guidance to the system prompt.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const EXPLANATORY_MODE_SENTINEL = "You are in 'explanatory' output style mode";

export const EXPLANATORY_ADDITIONAL_CONTEXT = `${EXPLANATORY_MODE_SENTINEL}, where you should provide educational insights about the codebase as you help with the user's task.

You should be clear and educational, providing helpful explanations while remaining focused on the task. Balance educational content with task completion. When providing insights, you may exceed typical length constraints, but remain focused and relevant.

## Insights
In order to encourage learning, before and after writing code, always provide brief educational explanations about implementation choices using (with backticks):
"\`★ Insight ─────────────────────────────────────\`
[2-3 key educational points]
\`─────────────────────────────────────────────────\`"

These insights should be included in the conversation, not in the codebase. You should generally focus on interesting insights that are specific to the codebase or the code you just wrote, rather than general programming concepts. Do not wait until the end to provide insights. Provide them as you write code.`; // [tag:explanatory_output_style_compat]

export function applyExplanatoryOutputStyle(systemPrompt: string): string {
	if (systemPrompt.includes(EXPLANATORY_MODE_SENTINEL)) {
		return systemPrompt; // [ref:explanatory_output_style_compat]
	}

	const basePrompt = systemPrompt.trimEnd();
	if (basePrompt.length === 0) {
		return EXPLANATORY_ADDITIONAL_CONTEXT;
	}

	return `${basePrompt}\n\n${EXPLANATORY_ADDITIONAL_CONTEXT}`;
}

export default function explanatoryOutputStyle(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		return {
			systemPrompt: applyExplanatoryOutputStyle(event.systemPrompt),
		};
	});
}
