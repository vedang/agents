import assert from "node:assert/strict";
import test from "node:test";

import explanatoryOutputStyle, {
	EXPLANATORY_ADDITIONAL_CONTEXT,
	applyExplanatoryOutputStyle,
} from "../explanatory-output-style";

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
	}) => Promise<{ systemPrompt: string } | void>;
	let beforeAgentStart: Handler | undefined;

	const pi = {
		on(eventName: string, handler: Handler) {
			if (eventName === "before_agent_start") {
				beforeAgentStart = handler;
			}
		},
	};

	explanatoryOutputStyle(pi as any);
	assert.ok(
		beforeAgentStart,
		"before_agent_start handler should be registered",
	);

	const result = await beforeAgentStart!({ systemPrompt: "BASE" });
	assert.ok(result);
	assert.ok(
		result!.systemPrompt.includes("You are in 'explanatory' output style mode"),
	);
});
