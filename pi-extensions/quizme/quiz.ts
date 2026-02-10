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

const decodeJsonString = (value: string): string => {
	try {
		return JSON.parse(`"${value}"`) as string;
	} catch {
		return value;
	}
};

const sanitizeJsonCandidate = (text: string): string => {
	const normalizedQuotes = text
		.replace(/[\u201C\u201D]/g, '"')
		.replace(/[\u2018\u2019]/g, "'");

	const withoutFences = normalizedQuotes
		.replace(/```json\s*/gi, "")
		.replace(/```/g, "");

	return withoutFences.replace(/,\s*([}\]])/g, "$1").trim();
};

const extractStringField = (text: string, key: string): string | undefined => {
	const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i");
	const match = text.match(pattern);
	if (!match?.[1]) {
		return undefined;
	}

	const decoded = decodeJsonString(match[1]).trim();
	return decoded.length > 0 ? decoded : undefined;
};

const extractChoicesField = (text: string): string[] | undefined => {
	const match = text.match(/"choices"\s*:\s*\[([\s\S]*?)\]/i);
	if (!match?.[1]) {
		return undefined;
	}

	const values = [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)]
		.map((value) => decodeJsonString(value[1] ?? "").trim())
		.filter((value) => value.length > 0);

	return values.length > 0 ? values : undefined;
};

const recoverQuestionsFromMalformedText = (
	text: string,
): QuizQuestion[] | undefined => {
	const markers = [...text.matchAll(/"id"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
	if (markers.length === 0) {
		return undefined;
	}

	const questions: QuizQuestion[] = [];
	const seenIds = new Set<string>();

	for (let index = 0; index < markers.length; index += 1) {
		const marker = markers[index];
		const markerIndex = marker.index ?? -1;
		if (markerIndex < 0) {
			continue;
		}

		const segmentStart = Math.max(
			text.lastIndexOf("{", markerIndex),
			markerIndex,
		);
		const nextMarkerIndex =
			index + 1 < markers.length
				? (markers[index + 1].index ?? text.length)
				: text.length;
		const segment = text.slice(segmentStart, nextMarkerIndex);

		const id = decodeJsonString(marker[1] ?? "").trim();
		if (!isNonEmptyString(id)) {
			continue;
		}

		if (id.toLowerCase() === "questions" || seenIds.has(id)) {
			continue;
		}

		const question = extractStringField(segment, "question");
		const answer = extractStringField(segment, "answer");
		if (!question || !answer) {
			continue;
		}

		seenIds.add(id);
		questions.push({
			id,
			question,
			answer,
			type: extractStringField(segment, "type"),
			choices: extractChoicesField(segment),
		});
	}

	return questions.length > 0 ? questions : undefined;
};

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

const normalizeGradingResults = (
	input: unknown,
): GradingResult[] | undefined => {
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

export const parseQuizPayloadWithRepair = (
	quizText: string,
): QuizPayload | undefined => {
	const parsed = parseQuizPayload(quizText);
	if (parsed) {
		return parsed;
	}

	const sanitized = sanitizeJsonCandidate(quizText);
	if (sanitized && sanitized !== quizText) {
		const repaired = parseQuizPayload(sanitized);
		if (repaired) {
			return repaired;
		}
	}

	const recoveredQuestions = recoverQuestionsFromMalformedText(
		sanitized || quizText,
	);
	if (!recoveredQuestions) {
		return undefined;
	}

	return { questions: recoveredQuestions };
};

export const buildQuizRepairPrompt = (malformedQuizText: string): string => {
	return [
		"You are a JSON repair assistant.",
		"Repair malformed quiz output into valid JSON matching the required schema.",
		"Keep recovered question meaning intact and do not include markdown fences.",
		"Drop unrecoverable question entries instead of emitting invalid JSON.",
		"",
		"Output format: [ref:quizme_quiz_payload_format]",
		QUIZ_OUTPUT_SPEC,
		"",
		"<malformed_quiz_output>",
		malformedQuizText || "(empty output)",
		"</malformed_quiz_output>",
	].join("\n");
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
	const resultsById = new Map(
		grading.results.map((result) => [result.id, result]),
	);

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

export type { GradingPayload, GradingResult, QuizPayload, QuizQuestion };
