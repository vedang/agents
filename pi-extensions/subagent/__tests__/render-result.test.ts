import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "..", "index.ts");

test("renderResult avoids repeating the delegated task prompt", () => {
	const source = readFileSync(sourcePath, "utf8");

	assert.equal(source.includes("─── Task ───"), false);
	assert.equal(source.includes('theme.fg("muted", "Task: ")'), false);
});

test("renderResult includes explicit model mismatch warnings", () => {
	const source = readFileSync(sourcePath, "utf8");

	assert.equal(source.includes("Model mismatch:"), true);
});

test("renderResult uses runtime model labels rather than requested fallbacks", () => {
	const source = readFileSync(sourcePath, "utf8");

	assert.equal(source.includes("getRuntimeModelLabel"), true);
	assert.equal(source.includes("getPreferredModelLabel"), false);
});
