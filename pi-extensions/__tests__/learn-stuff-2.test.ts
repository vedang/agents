import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
	const commands = new Map<string, { handler: CommandHandler }>();

	const pi = {
		on(eventName: string, handler: Handler) {
			if (eventName === "before_agent_start") {
				beforeAgentStart = handler;
			}
		},
		registerCommand(name: string, options: { handler: CommandHandler }) {
			commands.set(name, options);
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
	assert.equal(commands.has("learn-stuff:show-lessons"), true);
	assert.equal(commands.has("learn-stuff:add-lesson"), true);
	assert.equal(commands.has("show-lessons"), false);
});

test("learn-stuff:add-lesson writes to cwd AGENTS.md with dedupe", async () => {
	type CommandHandler = (args: string, ctx: unknown) => Promise<void>;
	const commands = new Map<string, { handler: CommandHandler }>();

	const pi = {
		on(_eventName: string, _handler: unknown) {
			// no-op
		},
		registerCommand(name: string, options: { handler: CommandHandler }) {
			commands.set(name, options);
		},
		events: {
			on(_eventName: string, _handler: (payload: unknown) => void) {
				// no-op
			},
		},
		sendMessage(_message: unknown, _options?: unknown) {
			// no-op
		},
	};

	learnStuffTwo(pi as never);
	const command = commands.get("learn-stuff:add-lesson");
	assert.ok(command, "learn-stuff:add-lesson command should be registered");

	const tempDir = mkdtempSync(join(tmpdir(), "learn-stuff-2-"));
	const agentsPath = join(tempDir, "AGENTS.md");

	try {
		const ctx = {
			cwd: tempDir,
			hasUI: false,
			ui: {
				notify(_message: string, _type: string) {
					// no-op
				},
			},
		};

		await command!.handler(
			"there is no need to create a commit when we change .agents/plans files, since .agents/plans is gitignored",
			ctx as never,
		);

		const firstWrite = readFileSync(agentsPath, "utf-8");
		assert.ok(firstWrite.includes("## Lessons"));
		assert.ok(
			firstWrite.includes(
				"- there is no need to create a commit when we change .agents/plans files, since .agents/plans is gitignored",
			),
		);

		await command!.handler(
			"there is no need to create commit when we change .agents/plans files since .agents/plans is gitignored",
			ctx as never,
		);

		const secondWrite = readFileSync(agentsPath, "utf-8");
		const matches = secondWrite.match(/- there is no need to create/gi) ?? [];
		assert.equal(matches.length, 1);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
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

test("mergeLessonsIntoAgentsContent de-duplicates strong canonical variants", () => {
	const existing = [
		"# Team Rules",
		"",
		"## Lessons",
		"",
		"- Persist lessons into nearest AGENTS file for each changed module.",
	].join("\n");

	const merged = mergeLessonsIntoAgentsContent(existing, [
		"Persisting lesson into nearest agents files for changed modules.",
	]);

	assert.equal(merged.addedCount, 0);
});

test("mergeLessonsIntoAgentsContent de-duplicates conservative fuzzy matches", () => {
	const existing = [
		"# Team Rules",
		"",
		"## Lessons",
		"",
		"- Capture lessons close to the modified auth module and keep them concise.",
	].join("\n");

	const merged = mergeLessonsIntoAgentsContent(existing, [
		"Capture lessons close to the modified auth module and keep them concise always.",
	]);

	assert.equal(merged.addedCount, 0);
});

test("mergeLessonsIntoAgentsContent keeps only locally non-duplicate lessons", () => {
	const existing = [
		"# Team Rules",
		"",
		"## Lessons",
		"",
		"- Capture lessons close to the modified auth module and keep them concise.",
	].join("\n");

	const merged = mergeLessonsIntoAgentsContent(existing, [
		"Document auth incident mitigations with explicit follow-up owners.",
	]);

	assert.equal(merged.addedCount, 1);
	assert.ok(
		merged.content.includes(
			"- Document auth incident mitigations with explicit follow-up owners.",
		),
	);
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
