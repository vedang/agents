import assert from "node:assert/strict";
import test from "node:test";

import {
	buildModelCliArgs,
	getModelMismatch,
	getPreferredModelLabel,
} from "../model-routing";

test("buildModelCliArgs splits provider/model frontmatter value", () => {
	const resolved = buildModelCliArgs("cerebras/zai-glm-4.7");

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, ["--provider", "cerebras", "--model", "zai-glm-4.7"]);
	assert.equal(resolved.requested?.raw, "cerebras/zai-glm-4.7");
	assert.equal(resolved.requested?.provider, "cerebras");
	assert.equal(resolved.requested?.model, "zai-glm-4.7");
});

test("buildModelCliArgs keeps bare model values backward compatible", () => {
	const resolved = buildModelCliArgs("gpt-5.2-codex");

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, ["--model", "gpt-5.2-codex"]);
	assert.equal(resolved.requested?.provider, undefined);
	assert.equal(resolved.requested?.model, "gpt-5.2-codex");
});

test("buildModelCliArgs supports provider/model values where model part contains slashes", () => {
	const resolved = buildModelCliArgs("openrouter/openai/gpt-5-codex");

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, ["--provider", "openrouter", "--model", "openai/gpt-5-codex"]);
	assert.equal(resolved.requested?.provider, "openrouter");
	assert.equal(resolved.requested?.model, "openai/gpt-5-codex");
});

test("buildModelCliArgs rejects malformed provider/model values", () => {
	for (const value of ["cerebras/", "/zai-glm-4.7", "   "]) {
		const resolved = buildModelCliArgs(value);
		assert.equal(resolved.ok, false);
		if (resolved.ok) continue;
		assert.match(resolved.error, /invalid model/i);
	}
});

test("getPreferredModelLabel prefers runtime provider/model when available", () => {
	const label = getPreferredModelLabel({
		requestedProvider: "cerebras",
		requestedModel: "zai-glm-4.7",
		runtimeProvider: "openai-codex",
		runtimeModel: "gpt-5.3-codex",
	});

	assert.equal(label, "openai-codex/gpt-5.3-codex");
});

test("getModelMismatch reports requested vs runtime mismatch for namespaced requests", () => {
	const mismatch = getModelMismatch({
		requestedProvider: "cerebras",
		requestedModel: "zai-glm-4.7",
		runtimeProvider: "openai-codex",
		runtimeModel: "gpt-5.3-codex",
	});

	assert.deepEqual(mismatch, {
		requested: "cerebras/zai-glm-4.7",
		actual: "openai-codex/gpt-5.3-codex",
	});
});

test("getModelMismatch does not treat bare requested model as provider mismatch", () => {
	const mismatch = getModelMismatch({
		requestedModel: "gpt-5.2-codex",
		runtimeProvider: "openai-codex",
		runtimeModel: "gpt-5.2-codex",
	});

	assert.equal(mismatch, null);
});
