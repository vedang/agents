/**
 * Learn-Stuff-2 Extension
 *
 * Minimal bootstrap for a lessons-oriented output style.
 * It appends guidance to the system prompt so the assistant emits
 * a concise `★ Lessons` block alongside normal output.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LEARN_STUFF_2_MODE_SENTINEL = "You are in 'learn-stuff-2' mode";

export const LEARN_STUFF_2_ADDITIONAL_CONTEXT = `${LEARN_STUFF_2_MODE_SENTINEL}, where you should include a concise lessons block alongside your normal response.

After each response, include this block format (with backticks):
"\`★ Lessons ─────────────────────────────────────\`
- [2-3 concise lessons learned from this step]
\`─────────────────────────────────────────────────\`"

Keep the lessons specific to the code change or debugging step. Do not write lessons into files unless the user explicitly asks.`; // [tag:learn_stuff_2_lessons_block_format]

export function applyLearnStuffTwo(systemPrompt: string): string {
	if (systemPrompt.includes(LEARN_STUFF_2_MODE_SENTINEL)) {
		return systemPrompt; // [ref:learn_stuff_2_lessons_block_format]
	}

	const basePrompt = systemPrompt.trimEnd();
	if (basePrompt.length === 0) {
		return LEARN_STUFF_2_ADDITIONAL_CONTEXT;
	}

	return `${basePrompt}\n\n${LEARN_STUFF_2_ADDITIONAL_CONTEXT}`;
}

export default function learnStuffTwo(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		return {
			systemPrompt: applyLearnStuffTwo(event.systemPrompt),
		};
	});
}
