import assert from "node:assert/strict";
import test from "node:test";

import { buildSubagentCallText } from "../render-call";

function createTheme() {
	return {
		fg(_color: string, text: string) {
			return text;
		},
		bold(text: string) {
			return text;
		},
	};
}

test("buildSubagentCallText renders full single task without truncation", () => {
	const theme = createTheme();
	const task =
		"Recon /Users/vedang/src/ohana/team007 for local development and enumerate every ClickHouse migration and API edge case in detail";

	const rendered = buildSubagentCallText({ agent: "scout", task }, theme);

	assert.ok(rendered.includes(task));
	assert.ok(rendered.includes("subagent scout [user]"));
	assert.ok(!rendered.includes("edge case in de..."));
});

test("buildSubagentCallText renders all parallel tasks with full prompts", () => {
	const theme = createTheme();
	const firstTask =
		"Inspect authentication and authorization flow, including role-based checks, token refresh handling, and service boundaries";
	const secondTask =
		"Collect all test fixtures and integration stubs related to upstream billing events, retries, and idempotency safeguards";

	const rendered = buildSubagentCallText(
		{
			tasks: [
				{ agent: "scout", task: firstTask },
				{ agent: "reviewer", task: secondTask },
			],
		},
		theme,
	);

	assert.ok(rendered.includes(firstTask));
	assert.ok(rendered.includes(secondTask));
	assert.ok(!rendered.includes("... +"));
});

test("buildSubagentCallText renders all chain steps with full prompts", () => {
	const theme = createTheme();
	const stepOne =
		"Locate all prompt templates that define the reporting format for weekly summaries, including any hidden defaults";
	const stepTwo =
		"Use {previous} to refine the summaries and cross-check for missing metrics in performance dashboards";

	const rendered = buildSubagentCallText(
		{
			chain: [
				{ agent: "scout", task: stepOne },
				{ agent: "planner", task: stepTwo },
			],
		},
		theme,
	);

	assert.ok(rendered.includes(stepOne));
	assert.ok(rendered.includes(stepTwo));
	assert.ok(!rendered.includes("... +"));
});
