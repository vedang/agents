import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "..", "index.ts");

test("learn-stuff source removes replay pipeline state", () => {
	const source = readFileSync(sourcePath, "utf8");

	assert.equal(source.includes("pendingOriginalOutputReplay"), false);
	assert.equal(source.includes("ORIGINAL_OUTPUT_MESSAGE_TYPE"), false);
	assert.equal(source.includes("Learn-stuff details"), false);
});

test("learn-stuff source keeps both manual commands", () => {
	const source = readFileSync(sourcePath, "utf8");

	assert.equal(source.includes('pi.registerCommand("learn-stuff"'), true);
	assert.equal(source.includes('pi.registerCommand("learn-stuff:lessons"'), true);
});

test("learn-stuff source emits Insight-style lessons block", () => {
	const source = readFileSync(sourcePath, "utf8");

	assert.equal(source.includes("★ Insight"), true);
});
