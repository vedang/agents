import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { Api, Model } from "@mariozechner/pi-ai";

import { createQuizmeDebugLogger } from "../debug";
import { QUIZME_MODEL, getQuizmeModelInfo } from "../model";

const DEBUG_ENV = "PI_QUIZME_DEBUG";

async function withEnv(
	key: string,
	value: string | undefined,
	action: () => Promise<void>,
): Promise<void> {
	const previous = process.env[key];
	if (value === undefined) {
		delete process.env[key];
	} else {
		process.env[key] = value;
	}

	try {
		await action();
	} finally {
		if (previous === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = previous;
		}
	}
}

function createModel(provider: string, id: string): Model<Api> {
	return { provider, id } as Model<Api>;
}

function parseModelSpec(spec: string): { provider: string; id: string } {
	const [provider, ...rest] = spec.split("/");
	return { provider, id: rest.join("/") };
}

test("createQuizmeDebugLogger is disabled by default", async () => {
	const baseDir = await mkdtemp(join(tmpdir(), "quizme-debug-"));

	try {
		await withEnv(DEBUG_ENV, undefined, async () => {
			const logger = createQuizmeDebugLogger({
				baseDir,
				identifier: "unit-test",
			});

			await logger.log({ step: "start" });

			await assert.rejects(stat(logger.filePath), { code: "ENOENT" });
		});
	} finally {
		await rm(baseDir, { recursive: true, force: true });
	}
});

test("createQuizmeDebugLogger can be enabled via environment variable", async () => {
	const baseDir = await mkdtemp(join(tmpdir(), "quizme-debug-"));

	try {
		await withEnv(DEBUG_ENV, "1", async () => {
			const logger = createQuizmeDebugLogger({
				baseDir,
				identifier: "unit-test",
			});

			await logger.log({ step: "start", value: 1 });

			const contents = await readFile(logger.filePath, "utf8");
			const data = JSON.parse(contents) as Record<string, unknown>;

			assert.equal(data.step, "start");
			assert.equal(data.value, 1);
		});
	} finally {
		await rm(baseDir, { recursive: true, force: true });
	}
});

test("createQuizmeDebugLogger writes merged snapshots", async () => {
	const baseDir = await mkdtemp(join(tmpdir(), "quizme-debug-"));
	const logger = createQuizmeDebugLogger({
		baseDir,
		identifier: "unit-test",
		enabled: true,
	});

	await logger.log({ step: "start", value: 1 });
	await logger.log({ step: "next", extra: "ok" });

	const contents = await readFile(logger.filePath, "utf8");
	const data = JSON.parse(contents) as Record<string, unknown>;

	assert.equal(data.step, "next");
	assert.equal(data.value, 1);
	assert.equal(data.extra, "ok");

	await rm(baseDir, { recursive: true, force: true });
});

test("getQuizmeModelInfo returns the quizme model when key exists", async () => {
	const { provider, id } = parseModelSpec(QUIZME_MODEL);
	const quizModel = createModel(provider, id);
	const activeModel = createModel("openai", "gpt-test");

	const modelInfo = await getQuizmeModelInfo(
		{
			find(lookupProvider: string, lookupId: string) {
				assert.equal(lookupProvider, provider);
				assert.equal(lookupId, id);
				return quizModel;
			},
			async getApiKey(model: Model<Api>) {
				return model === quizModel ? "quiz-key" : undefined;
			},
		},
		activeModel,
	);

	assert.deepEqual(modelInfo, { model: quizModel, apiKey: "quiz-key" });
});

test("getQuizmeModelInfo falls back to active model when quiz key missing", async () => {
	const { provider, id } = parseModelSpec(QUIZME_MODEL);
	const quizModel = createModel(provider, id);
	const activeModel = createModel("openai", "gpt-test");

	const modelInfo = await getQuizmeModelInfo(
		{
			find() {
				return quizModel;
			},
			async getApiKey(model: Model<Api>) {
				return model === activeModel ? "active-key" : undefined;
			},
		},
		activeModel,
	);

	assert.deepEqual(modelInfo, { model: activeModel, apiKey: "active-key" });
});

test("getQuizmeModelInfo falls back when quiz model is unavailable", async () => {
	const activeModel = createModel("openai", "gpt-test");

	const modelInfo = await getQuizmeModelInfo(
		{
			find() {
				return undefined;
			},
			async getApiKey(model: Model<Api>) {
				return model === activeModel ? "active-key" : undefined;
			},
		},
		activeModel,
	);

	assert.deepEqual(modelInfo, { model: activeModel, apiKey: "active-key" });
});

test("getQuizmeModelInfo returns undefined when no keys available", async () => {
	const { provider, id } = parseModelSpec(QUIZME_MODEL);
	const quizModel = createModel(provider, id);
	const activeModel = createModel("openai", "gpt-test");

	const modelInfo = await getQuizmeModelInfo(
		{
			find() {
				return quizModel;
			},
			async getApiKey() {
				return undefined;
			},
		},
		activeModel,
	);

	assert.equal(modelInfo, undefined);
});
