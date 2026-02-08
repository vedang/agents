import assert from "node:assert/strict";
import test from "node:test";

import {
	buildInterestingEventReasons,
	mergeInterestingReasons,
	isLikelyUserCorrection,
} from "../interesting-events";

test("isLikelyUserCorrection detects explicit correction language", () => {
	assert.equal(isLikelyUserCorrection("No, this is wrong. Use jj new first."), true);
	assert.equal(isLikelyUserCorrection("This didn't work, please retry with provider/model split."), true);
	assert.equal(isLikelyUserCorrection("Thanks, looks good."), false);
});

test("buildInterestingEventReasons captures failing tool results", () => {
	const reasons = buildInterestingEventReasons({
		toolName: "bash",
		isError: true,
		content: [{ type: "text", text: "command failed: permission denied" }],
	});

	assert.equal(reasons.length, 1);
	assert.match(reasons[0], /tool bash failed/i);
});

test("mergeInterestingReasons de-duplicates and preserves order", () => {
	const merged = mergeInterestingReasons(
		["Tool bash failed: permission denied", "User correction: do not batch commits"],
		["Tool bash failed: permission denied", "User correction: prefer provider/model split"],
	);

	assert.deepEqual(merged, [
		"Tool bash failed: permission denied",
		"User correction: do not batch commits",
		"User correction: prefer provider/model split",
	]);
});
