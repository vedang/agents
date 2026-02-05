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

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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
  try {
    const parsed = JSON.parse(quizText) as Record<string, unknown>;
    const questions = normalizeQuestions(parsed.questions);
    if (!questions) {
      return undefined;
    }

    return { questions };
  } catch {
    return undefined;
  }
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
    "Respond with Correct or Incorrect for each question and a brief explanation.",
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

export type { QuizPayload, QuizQuestion };
