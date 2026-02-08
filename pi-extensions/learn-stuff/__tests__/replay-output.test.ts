import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ORIGINAL_OUTPUT_MESSAGE_TYPE,
  buildOriginalOutputReplayMessage,
  extractLatestAssistantText,
  shouldReplayOriginalOutput,
} from "../replay";

const indexSourcePath = join(dirname(fileURLToPath(import.meta.url)), "..", "index.ts");

test("extractLatestAssistantText returns last assistant text block", () => {
  const text = extractLatestAssistantText({
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "first" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "second" }],
      },
    ],
  });

  assert.equal(text, "second");
});

test("extractLatestAssistantText returns null when no assistant text exists", () => {
  const text = extractLatestAssistantText({
    messages: [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "read", arguments: {} }],
      },
    ],
  });

  assert.equal(text, null);
});

test("shouldReplayOriginalOutput gates replay to learn-stuff extension follow-up", () => {
  assert.equal(
    shouldReplayOriginalOutput({
      hasPendingMessages: false,
      hasPendingReplayText: true,
      lastInputSource: "extension",
      lastInputText: "/learn-stuff session_end",
    }),
    true,
  );

  assert.equal(
    shouldReplayOriginalOutput({
      hasPendingMessages: false,
      hasPendingReplayText: true,
      lastInputSource: "interactive",
      lastInputText: "/learn-stuff session_end",
    }),
    false,
  );
});

test("buildOriginalOutputReplayMessage returns displayable custom message", () => {
  const message = buildOriginalOutputReplayMessage("Original answer", "session_end");

  assert.equal(message.customType, ORIGINAL_OUTPUT_MESSAGE_TYPE);
  assert.equal(message.content, "Original answer");
  assert.equal(message.display, true);
  assert.equal(message.details.reason, "session_end");
});

test("learn-stuff extension source wires replay helper", () => {
  const source = readFileSync(indexSourcePath, "utf8");

  assert.ok(source.includes("ORIGINAL_OUTPUT_MESSAGE_TYPE"));
  assert.ok(source.includes("shouldReplayOriginalOutput("));
  assert.ok(source.includes("buildOriginalOutputReplayMessage("));
});
