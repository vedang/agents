import assert from "node:assert/strict";
import test from "node:test";

import { extractLessonsSummary, formatInsightLessonsBlock, limitToSentences } from "../lessons-format";

test("extractLessonsSummary prefers explicit Lessons section", () => {
	const output = `## Completed\nUpdated files.\n\n## Lessons\nAlways split provider/model before spawning child pi processes. Verify runtime provider in JSON events.\n\n## Notes\nDone.`;

	const lesson = extractLessonsSummary(output);
	assert.equal(
		lesson,
		"Always split provider/model before spawning child pi processes. Verify runtime provider in JSON events.",
	);
});

test("limitToSentences enforces at most two sentences", () => {
	const text =
		"First sentence is useful. Second sentence is also useful. Third sentence should be dropped.";
	assert.equal(limitToSentences(text, 2), "First sentence is useful. Second sentence is also useful.");
});

test("formatInsightLessonsBlock renders Insight-style frame", () => {
	const block = formatInsightLessonsBlock("Always capture durable lessons near the affected scope.");

	assert.match(block, /^★ Insight ─/);
	assert.match(block, /Always capture durable lessons near the affected scope\./);
	assert.match(block, /─+$/m);
});
