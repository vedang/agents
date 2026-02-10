import assert from "node:assert/strict";
import test from "node:test";

import explanatoryOutputStyle, {
	EXPLANATORY_ADDITIONAL_CONTEXT,
	applyExplanatoryOutputStyle,
} from "../explanatory-output-style";

function assertDefined<T>(value: T | undefined, message: string): T {
	assert.ok(value, message);
	return value;
}

test("applyExplanatoryOutputStyle appends explanatory guidance", () => {
	const basePrompt = "You are a coding assistant.";
	const prompt = applyExplanatoryOutputStyle(basePrompt);

	assert.ok(prompt.startsWith(basePrompt));
	assert.ok(prompt.includes("You are in 'explanatory' output style mode"));
	assert.ok(prompt.includes("★ Insight ─────────────────────────────────────")); // [ref:explanatory_output_style_compat]
	assert.ok(prompt.endsWith(EXPLANATORY_ADDITIONAL_CONTEXT));
});

test("applyExplanatoryOutputStyle is idempotent when context already exists", () => {
	const basePrompt = `Base\n\n${EXPLANATORY_ADDITIONAL_CONTEXT}`;
	const prompt = applyExplanatoryOutputStyle(basePrompt);

	assert.equal(prompt, basePrompt);
});

test("extension registers before_agent_start and injects context", async () => {
	type Handler = (event: {
		systemPrompt: string;
	}) => Promise<{ systemPrompt: string } | undefined>;
	let beforeAgentStart: Handler | undefined;

	const pi = {
		on(eventName: string, handler: Handler) {
			if (eventName === "before_agent_start") {
				beforeAgentStart = handler;
			}
		},
	};

	explanatoryOutputStyle(pi as Parameters<typeof explanatoryOutputStyle>[0]);
	const handler = assertDefined(
		beforeAgentStart,
		"before_agent_start handler should be registered",
	);

	const result = assertDefined(
		await handler({ systemPrompt: "BASE" }),
		"before_agent_start handler should return updated system prompt",
	);
	assert.ok(
		result.systemPrompt.includes("You are in 'explanatory' output style mode"),
	);
});
