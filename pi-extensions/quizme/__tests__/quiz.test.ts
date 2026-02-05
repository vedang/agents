import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGradingPrompt,
  buildQuizPrompt,
  parseQuizPayload,
} from "../quiz";

test("parseQuizPayload parses quiz JSON", () => {
  const payload = {
    questions: [
      {
        id: "q1",
        question: "What changed?",
        answer: "A detail",
        type: "short-answer",
        choices: ["A", "B"],
      },
    ],
  };

  const parsed = parseQuizPayload(JSON.stringify(payload));

  assert.ok(parsed);
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].id, "q1");
  assert.equal(parsed.questions[0].question, "What changed?");
  assert.equal(parsed.questions[0].answer, "A detail");
  assert.equal(parsed.questions[0].type, "short-answer");
  assert.deepEqual(parsed.questions[0].choices, ["A", "B"]);
});

test("parseQuizPayload returns undefined for invalid payload", () => {
  const parsed = parseQuizPayload("{not-json}");

  assert.equal(parsed, undefined);
});

test("buildQuizPrompt includes format instructions", () => {
  const prompt = buildQuizPrompt("Instructions", "Conversation text");

  assert.ok(prompt.includes("Quiz output format"));
  assert.ok(prompt.includes("questions"));
});

test("buildGradingPrompt includes expected and user answers", () => {
  const quiz = {
    questions: [
      {
        id: "q1",
        question: "Why?",
        answer: "Because",
        type: "explain-why",
      },
    ],
  };

  const prompt = buildGradingPrompt(quiz, ["My answer"]);

  assert.ok(prompt.includes("Expected answer"));
  assert.ok(prompt.includes("User answer"));
  assert.ok(prompt.includes("Because"));
  assert.ok(prompt.includes("My answer"));
});
