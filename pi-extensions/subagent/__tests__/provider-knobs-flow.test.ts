import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	buildSubagentProviderEnv,
	parseSubagentProviderFrontmatter,
} from "../provider-env";

const subagentDir = dirname(fileURLToPath(import.meta.url));

test("subagent role-level frontmatter knobs are parsed and propagated to child env", () => {
	const knobs = parseSubagentProviderFrontmatter({
		temperature: 0.66,
		top_p: 0.88,
		clear_thinking: true,
		zai_base_url: "https://api.z.ai/api/coding/paas/v4",
	});

	assert.equal(knobs.temperature, 0.66);
	assert.equal(knobs.topP, 0.88);
	assert.equal(knobs.clearThinking, true);
	assert.equal(knobs.zaiBaseUrl, "https://api.z.ai/api/coding/paas/v4");

	const childEnv = buildSubagentProviderEnv(knobs, { PATH: process.env.PATH });
	assert.equal(childEnv.PI_TEMPERATURE, "0.66");
	assert.equal(childEnv.PI_ZAI_CUSTOM_TOP_P, "0.88");
	assert.equal(childEnv.PI_ZAI_CUSTOM_CLEAR_THINKING, "true");
	assert.equal(
		childEnv.PI_ZAI_CUSTOM_BASE_URL,
		"https://api.z.ai/api/coding/paas/v4",
	);
	assert.equal(childEnv.PI_ZAI_TEMPERATURE, undefined);
	assert.equal(childEnv.PI_ZAI_TOP_P, undefined);
	assert.equal(childEnv.PI_ZAI_CLEAR_THINKING, undefined);
	assert.equal(childEnv.PI_ZAI_BASE_URL, undefined);
	assert.equal(childEnv.ZAI_TEMPERATURE, undefined);
	assert.equal(childEnv.ZAI_TOP_P, undefined);
	assert.equal(childEnv.ZAI_CLEAR_THINKING, undefined);
	assert.equal(childEnv.ZAI_BASE_URL, undefined);
});

test("subagent implementation wires frontmatter knobs into spawn env", () => {
	const agentsSource = readFileSync(
		join(subagentDir, "..", "agents.ts"),
		"utf-8",
	);
	assert.equal(
		agentsSource.includes("parseSubagentProviderFrontmatter(frontmatter)"),
		true,
	);

	const indexSource = readFileSync(
		join(subagentDir, "..", "index.ts"),
		"utf-8",
	);
	assert.equal(
		indexSource.includes("buildSubagentProviderEnv(agent, process.env)"),
		true,
	);
	assert.equal(indexSource.includes("env: childEnv"), true);
});
