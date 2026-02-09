import assert from "node:assert/strict";
import test from "node:test";

import learnStuffTwo, {
	LEARN_STUFF_2_ADDITIONAL_CONTEXT,
	applyLearnStuffTwo,
} from "../learn-stuff-2";

test("applyLearnStuffTwo appends lessons guidance", () => {
	const basePrompt = "You are a coding assistant.";
	const prompt = applyLearnStuffTwo(basePrompt);

	assert.ok(prompt.startsWith(basePrompt));
	assert.ok(prompt.includes("You are in 'learn-stuff-2' mode"));
	assert.ok(prompt.includes("★ Lessons ─────────────────────────────────────")); // [ref:learn_stuff_2_lessons_block_format]
	assert.ok(prompt.endsWith(LEARN_STUFF_2_ADDITIONAL_CONTEXT));
});

test("applyLearnStuffTwo is idempotent when context already exists", () => {
	const basePrompt = `Base\n\n${LEARN_STUFF_2_ADDITIONAL_CONTEXT}`;
	const prompt = applyLearnStuffTwo(basePrompt);

	assert.equal(prompt, basePrompt);
});

test("extension registers before_agent_start and injects context", async () => {
	type Handler = (event: { systemPrompt: string }) => Promise<{ systemPrompt: string } | void>;
	let beforeAgentStart: Handler | undefined;

	const pi = {
		on(eventName: string, handler: Handler) {
			if (eventName === "before_agent_start") {
				beforeAgentStart = handler;
			}
		},
	};

	learnStuffTwo(pi as any);
	assert.ok(beforeAgentStart, "before_agent_start handler should be registered");

	const result = await beforeAgentStart!({ systemPrompt: "BASE" });
	assert.ok(result);
	assert.ok(result!.systemPrompt.includes("You are in 'learn-stuff-2' mode"));
});
