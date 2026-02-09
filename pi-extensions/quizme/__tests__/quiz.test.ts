import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGradingPrompt,
  buildQuizPrompt,
  formatGradingResultsMarkdown,
  parseGradingPayload,
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

test("buildGradingPrompt includes grading output spec", () => {
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
  assert.ok(prompt.includes("Grading output format"));
  assert.ok(prompt.includes("results"));
});

test("parseGradingPayload parses grading JSON", () => {
  const payload = {
    results: [
      {
        id: "q1",
        verdict: "Correct",
        explanation: "You identified the key change.",
      },
    ],
  };

  const parsed = parseGradingPayload(JSON.stringify(payload));

  assert.ok(parsed);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].id, "q1");
  assert.equal(parsed.results[0].verdict, "Correct");
  assert.equal(parsed.results[0].explanation, "You identified the key change.");
});

test("formatGradingResultsMarkdown includes question text and omits choices", () => {
  const quiz = {
    questions: [
      {
        id: "q1",
        question: "Why did we update the config?",
        answer: "To align defaults",
        type: "multiple-choice",
        choices: ["A", "B", "C"],
      },
    ],
  };

  const grading = {
    results: [
      {
        id: "q1",
        verdict: "Incorrect",
        explanation: "The update was to align defaults with team conventions.",
      },
    ],
  };

  const markdown = formatGradingResultsMarkdown(quiz, grading);

  assert.ok(markdown.includes("### Question 1: Why did we update the config?"));
  assert.ok(markdown.includes("**Result:** Incorrect"));
  assert.ok(
    markdown.includes(
      "**Explanation:** The update was to align defaults with team conventions.",
    ),
  );
  assert.equal(markdown.includes("**Choices:**"), false);
});
