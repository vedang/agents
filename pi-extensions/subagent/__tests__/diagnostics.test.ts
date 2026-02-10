import assert from "node:assert/strict";
import test from "node:test";

import {
	buildFailureDiagnostics,
	parseProviderError,
	stderrTail,
} from "../diagnostics";

test("parseProviderError extracts status and no-body marker", () => {
	const parsed = parseProviderError("503 status code (no body)");

	assert.equal(parsed.statusCode, 503);
	assert.equal(parsed.hasNoBody, true);
	assert.equal(parsed.retryable, true);
	assert.equal(parsed.bodyDescriptor, "no body");
});

test("parseProviderError marks 429 as retryable", () => {
	const parsed = parseProviderError("429 Too many requests");

	assert.equal(parsed.statusCode, 429);
	assert.equal(parsed.retryable, true);
	assert.equal(parsed.hasNoBody, undefined);
});

test("stderrTail keeps only the end of long stderr output", () => {
	const input = `${"x".repeat(4100)}TAIL`;
	const tail = stderrTail(input, 64);

	assert.ok(tail?.startsWith("…"));
	assert.ok(tail?.endsWith("TAIL"));
	assert.ok((tail?.length ?? 0) <= 65);
});

test("buildFailureDiagnostics includes event counts and snapshots", () => {
	const diagnostics = buildFailureDiagnostics({
		errorMessage: "503 status code (no body)",
		stopReason: "error",
		exitCode: 0,
		requestedProvider: "cerebras",
		requestedModel: "zai-glm-4.7",
		runtimeProvider: "cerebras",
		runtimeModel: "zai-glm-4.7",
		parsedEventCount: 42,
		messageEndCount: 7,
		toolResultEndCount: 11,
		recentEvents: [
			{ type: "message_end", role: "assistant", stopReason: "toolUse" },
			{ type: "tool_result_end", role: "toolResult", toolName: "bash", isError: false },
		],
		lastToolCall: { name: "subagent", argumentsPreview: "{\"chain\":...}" },
		lastToolResult: { toolName: "bash", isError: true, preview: "error: ..." },
		stderr: "line1\nline2",
	});

	assert.equal(diagnostics.statusCode, 503);
	assert.equal(diagnostics.hasNoBody, true);
	assert.equal(diagnostics.eventCounts.parsed, 42);
	assert.equal(diagnostics.eventCounts.messageEnd, 7);
	assert.equal(diagnostics.eventCounts.toolResultEnd, 11);
	assert.equal(diagnostics.recentEvents.length, 2);
	assert.equal(diagnostics.lastToolCall?.name, "subagent");
	assert.equal(diagnostics.lastToolResult?.toolName, "bash");
	assert.equal(diagnostics.stderrTail, "line1\nline2");
});
