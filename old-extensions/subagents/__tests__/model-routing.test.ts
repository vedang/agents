import assert from "node:assert/strict";
import test from "node:test";

import {
	buildModelCliArgs,
	getModelMismatch,
	getRuntimeModelLabel,
} from "../model-routing";

test("buildModelCliArgs uses explicit provider + model frontmatter keys", () => {
	const resolved = buildModelCliArgs("cerebras", "zai-glm-4.7");

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, [
		"--provider",
		"cerebras",
		"--model",
		"zai-glm-4.7",
	]);
	assert.equal(resolved.requested?.provider, "cerebras");
	assert.equal(resolved.requested?.model, "zai-glm-4.7");
});

test("buildModelCliArgs keeps model-only values backward compatible", () => {
	const resolved = buildModelCliArgs(undefined, "gpt-5.2-codex");

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, ["--model", "gpt-5.2-codex"]);
	assert.equal(resolved.requested?.provider, undefined);
	assert.equal(resolved.requested?.model, "gpt-5.2-codex");
});

test("buildModelCliArgs allows missing provider+model and uses default runtime model", () => {
	const resolved = buildModelCliArgs(undefined, undefined);

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, []);
	assert.equal(resolved.requested, null);
});

test("buildModelCliArgs allows slash-containing model when provider is explicit", () => {
	const resolved = buildModelCliArgs("openrouter", "openai/gpt-5-codex");

	assert.equal(resolved.ok, true);
	if (!resolved.ok) return;
	assert.deepEqual(resolved.args, [
		"--provider",
		"openrouter",
		"--model",
		"openai/gpt-5-codex",
	]);
});

test("buildModelCliArgs rejects namespaced model without explicit provider", () => {
	const resolved = buildModelCliArgs(undefined, "cerebras/zai-glm-4.7");

	assert.equal(resolved.ok, false);
	if (resolved.ok) return;
	assert.match(resolved.error, /provider/i);
	assert.match(resolved.error, /model:/i);
});

test("buildModelCliArgs rejects empty model values", () => {
	const resolved = buildModelCliArgs("cerebras", "   ");

	assert.equal(resolved.ok, false);
	if (resolved.ok) return;
	assert.match(resolved.error, /model/i);
});

test("getRuntimeModelLabel always reports runtime provider/model only", () => {
	const label = getRuntimeModelLabel({
		requestedProvider: "cerebras",
		requestedModel: "zai-glm-4.7",
		runtimeProvider: "openai-codex",
		runtimeModel: "gpt-5.3-codex",
	});

	assert.equal(label, "openai-codex/gpt-5.3-codex");

	const noRuntime = getRuntimeModelLabel({
		requestedProvider: "cerebras",
		requestedModel: "zai-glm-4.7",
	});
	assert.equal(noRuntime, undefined);
});

test("getModelMismatch reports requested vs runtime mismatch for explicit provider", () => {
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
