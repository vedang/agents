import assert from "node:assert/strict";
import test from "node:test";

import learnStuffTwo, {
	LEARN_STUFF_2_ADDITIONAL_CONTEXT,
	applyLearnStuffTwo,
	extractLessonsFromAssistantOutput,
	extractLessonsSectionsFromAgentsContent,
	mergeLessonsIntoAgentsContent,
	resolveNearestAgentsPathForModifiedFile,
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

	type CommandHandler = (args: string, ctx: unknown) => Promise<void>;

	const pi = {
		on(eventName: string, handler: Handler) {
			if (eventName === "before_agent_start") {
				beforeAgentStart = handler;
			}
		},
		registerCommand(_name: string, _options: { handler: CommandHandler }) {
			// no-op
		},
		events: {
			on(_eventName: string, _handler: (payload: unknown) => void) {
				// no-op
			},
		},
	};

	learnStuffTwo(pi as never);
	assert.ok(beforeAgentStart, "before_agent_start handler should be registered");

	const result = await beforeAgentStart!({ systemPrompt: "BASE" });
	assert.ok(result);
	assert.ok(result!.systemPrompt.includes("You are in 'learn-stuff-2' mode"));
});

test("extractLessonsFromAssistantOutput parses lessons bullets from block", () => {
	const assistantOutput = [
		"Done.",
		"",
		"`★ Lessons ─────────────────────────────────────`",
		"- Keep lessons scoped to changed module.",
		"- Prefer deterministic parsers over regex-only hacks.",
		"`─────────────────────────────────────────────────`",
	].join("\n");

	assert.deepEqual(extractLessonsFromAssistantOutput(assistantOutput), [
		"Keep lessons scoped to changed module.",
		"Prefer deterministic parsers over regex-only hacks.",
	]);
});

test("mergeLessonsIntoAgentsContent appends only new lessons", () => {
	const existing = ["# Team Rules", "", "## Lessons", "", "- Keep outputs concise.", ""].join("\n");
	const merged = mergeLessonsIntoAgentsContent(existing, [
		"Keep outputs concise.",
		"Persist lessons close to changed code.",
	]);

	assert.equal(merged.addedCount, 1);
	assert.ok(merged.content.includes("- Keep outputs concise."));
	assert.ok(merged.content.includes("- Persist lessons close to changed code."));
});

test("resolveNearestAgentsPathForModifiedFile prefers nearest existing AGENTS", () => {
	const root = "/repo";
	const modifiedFile = "/repo/src/someproject/auth/service.ts";
	const existingAgents = new Set([
		"/repo/AGENTS.md",
		"/repo/src/someproject/auth/AGENTS.md",
	]);

	const resolved = resolveNearestAgentsPathForModifiedFile(modifiedFile, root, (path) =>
		existingAgents.has(path),
	);

	assert.equal(resolved, "/repo/src/someproject/auth/AGENTS.md");
});

test("resolveNearestAgentsPathForModifiedFile falls back to changed file directory", () => {
	const root = "/repo";
	const modifiedFile = "/repo/src/payments/ledger/reconcile.ts";
	const existingAgents = new Set(["/repo/AGENTS.md"]);

	const resolved = resolveNearestAgentsPathForModifiedFile(modifiedFile, root, (path) =>
		existingAgents.has(path),
	);

	assert.equal(resolved, "/repo/src/payments/ledger/AGENTS.md");
});

test("extractLessonsSectionsFromAgentsContent collects all Lessons sections", () => {
	const content = [
		"# Global",
		"",
		"## Lessons",
		"- Keep summaries short.",
		"",
		"### Lessons: Debugging",
		"- Capture reproductions in one line.",
		"",
		"## Other",
		"Ignore.",
	].join("\n");

	assert.deepEqual(extractLessonsSectionsFromAgentsContent(content), [
		"- Keep summaries short.\n\n### Lessons: Debugging\n- Capture reproductions in one line.",
	]);
});
