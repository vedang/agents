type QuizQuestion = {
  id: string;
  question: string;
  answer: string;
  type?: string;
  choices?: string[];
};

type QuizPayload = {
  questions: QuizQuestion[];
};

type GradingResult = {
  id: string;
  verdict?: string;
  explanation?: string;
};

type GradingPayload = {
  results: GradingResult[];
};

const QUIZ_OUTPUT_SPEC = `Quiz output format: return only JSON with this shape:
{
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "answer": "...",
      "type": "multiple-choice | short-answer | explain-why",
      "choices": ["A", "B", "C", "D"]
    }
  ]
}
Notes:
- Always include the question and the correct answer.
- Include choices only for multiple-choice questions.
- Keep the JSON concise and free of markdown fences.`; // [tag:quizme_quiz_payload_format]

const GRADING_OUTPUT_SPEC = `Grading output format: return only JSON with this shape:
{
  "results": [
    {
      "id": "q1",
      "verdict": "Correct | Partially Correct | Incorrect",
      "explanation": "..."
    }
  ]
}
Notes:
- Include exactly one result per question.
- Keep explanations concise.
- Do not include question choices in the output.
- Keep the JSON concise and free of markdown fences.`; // [tag:quizme_grading_payload_format]

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const tryParseObject = (text: string): Record<string, unknown> | undefined => {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const candidates: string[] = [];
  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  // Prefer later fenced blocks first because models may include an example
  // payload before the final answer.
  candidates.push(...fencedMatches.reverse());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  candidates.push(trimmed);

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try next candidate variant.
    }
  }

  return undefined;
};

const normalizeQuestions = (input: unknown): QuizQuestion[] | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const questions: QuizQuestion[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      return undefined;
    }

    const record = entry as Record<string, unknown>;
    if (!isNonEmptyString(record.id)) {
      return undefined;
    }
    if (!isNonEmptyString(record.question)) {
      return undefined;
    }
    if (!isNonEmptyString(record.answer)) {
      return undefined;
    }

    const choices = Array.isArray(record.choices)
      ? record.choices.filter(isNonEmptyString)
      : undefined;

    questions.push({
      id: record.id,
      question: record.question,
      answer: record.answer,
      type: isNonEmptyString(record.type) ? record.type : undefined,
      choices: choices && choices.length > 0 ? choices : undefined,
    });
  }

  return questions.length > 0 ? questions : undefined;
};

const normalizeGradingResults = (input: unknown): GradingResult[] | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const results: GradingResult[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      return undefined;
    }

    const record = entry as Record<string, unknown>;
    if (!isNonEmptyString(record.id)) {
      return undefined;
    }

    results.push({
      id: record.id,
      verdict: isNonEmptyString(record.verdict) ? record.verdict : undefined,
      explanation: isNonEmptyString(record.explanation)
        ? record.explanation
        : undefined,
    });
  }

  return results.length > 0 ? results : undefined;
};

export const buildQuizPrompt = (
  instructions: string,
  conversationText: string,
): string => {
  return [
    instructions.trim(),
    "",
    QUIZ_OUTPUT_SPEC,
    "",
    "Session transcript:",
    "<conversation>",
    conversationText || "(No conversation text was captured.)",
    "</conversation>",
  ].join("\n");
};

export const parseQuizPayload = (quizText: string): QuizPayload | undefined => {
  const parsed = tryParseObject(quizText);
  if (!parsed) {
    return undefined;
  }

  const questions = normalizeQuestions(parsed.questions);
  if (!questions) {
    return undefined;
  }

  return { questions };
};

export const formatQuestionMarkdown = (
  question: QuizQuestion,
  index: number,
  total: number,
  currentAnswer: string,
): string => {
  const remaining = total - index - 1;
  const header = `### Question ${index + 1} of ${total} (${remaining} remaining)`;
  const typeLine = question.type ? `**Type:** ${question.type}` : undefined;
  const choiceLines = question.choices
    ? question.choices.map((choice, idx) => `${idx + 1}. ${choice}`)
    : [];
  const answerLine = currentAnswer.trim()
    ? `**Current answer:** ${currentAnswer}`
    : "**Current answer:** _(no answer yet)_";

  return [
    header,
    "",
    question.question,
    typeLine,
    choiceLines.length > 0 ? "**Choices:**" : undefined,
    ...choiceLines,
    "",
    answerLine,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
};

export const buildGradingPrompt = (
  quiz: QuizPayload,
  answers: string[],
): string => {
  const lines = [
    "You are the quiz grader.",
    "Check each user answer against the expected answer.",
    "Decide whether each answer is Correct, Partially Correct, or Incorrect.",
    "",
    "Output format: [ref:quizme_grading_payload_format]",
    GRADING_OUTPUT_SPEC,
    "",
    "<questions>",
  ];

  quiz.questions.forEach((question, index) => {
    lines.push(`Question ${index + 1} (${question.id}): ${question.question}`);
    if (question.type) {
      lines.push(`Type: ${question.type}`);
    }
    if (question.choices?.length) {
      lines.push(`Choices: ${question.choices.join(" | ")}`);
    }
    lines.push(`Expected answer: ${question.answer}`);
    lines.push(`User answer: ${answers[index] ?? ""}`);
    lines.push("");
  });

  lines.push("</questions>");

  return lines.join("\n");
};

export const parseGradingPayload = (
  gradingText: string,
): GradingPayload | undefined => {
  const parsed = tryParseObject(gradingText);
  if (!parsed) {
    return undefined;
  }

  const results = normalizeGradingResults(parsed.results);
  if (!results) {
    return undefined;
  }

  return { results };
};

export const formatGradingResultsMarkdown = (
  quiz: QuizPayload,
  grading: GradingPayload,
): string => {
  const resultsById = new Map(grading.results.map((result) => [result.id, result]));

  return quiz.questions
    .map((question, index) => {
      const result = resultsById.get(question.id) ?? grading.results[index];
      const verdict = result?.verdict?.trim() || "Ungraded";
      const explanation =
        result?.explanation?.trim() || "No explanation was provided.";

      return [
        `### Question ${index + 1}: ${question.question}`,
        `**Result:** ${verdict}`,
        `**Explanation:** ${explanation}`,
      ].join("\n");
    })
    .join("\n\n");
};

export type {
  GradingPayload,
  GradingResult,
  QuizPayload,
  QuizQuestion,
};
