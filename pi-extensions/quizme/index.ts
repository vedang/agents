/**
 * Quiz Me Tool - Check if you understood what your harness did this session
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { completeSimple } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@mariozechner/pi-tui";

import { createQuizmeDebugLogger } from "./debug";
import { getQuizmeModelInfo } from "./model";
import {
  buildGradingPrompt,
  buildQuizPrompt,
  buildQuizRepairPrompt,
  formatGradingResultsMarkdown,
  formatQuestionMarkdown,
  parseGradingPayload,
  parseQuizPayloadWithRepair,
} from "./quiz";

type ContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: Record<string, unknown>;
};

type SessionEntry = {
  type: string;
  message?: {
    role?: string;
    content?: unknown;
    toolName?: string;
  };
};

const QUIZ_PROMPT_PATH = join(
  homedir(),
  ".pi",
  "agent",
  "extensions",
  "quizme",
  "prompt.md",
);
const GRADING_SYSTEM_PROMPT =
  "You are a quiz grader who only checks answer correctness and returns JSON in the requested grading schema.";
const QUIZ_REPAIR_SYSTEM_PROMPT =
  "You repair malformed quiz payloads into strict JSON with a top-level questions array. Return only valid JSON.";
const TOOL_OUTPUT_MAX_LINES = 40;
const TOOL_OUTPUT_MAX_CHARS = 4000;
const THINKING_MAX_LINES = 12;
const THINKING_MAX_CHARS = 2000;

const truncateText = (
  text: string,
  options: { maxLines: number; maxChars: number; suffix?: string },
): string => {
  const normalized = text.trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized.split(/\r?\n/);
  let truncated = false;
  let limitedLines = lines;
  if (lines.length > options.maxLines) {
    limitedLines = lines.slice(0, options.maxLines);
    truncated = true;
  }

  let joined = limitedLines.join("\n");
  if (joined.length > options.maxChars) {
    joined = joined.slice(0, options.maxChars).trimEnd();
    truncated = true;
  }

  if (truncated) {
    const suffix = options.suffix ?? "… (truncated)";
    return `${joined}\n${suffix}`.trim();
  }

  return joined;
};

const extractTextParts = (content: unknown): string[] => {
  if (typeof content === "string") {
    return [content];
  }

  if (!Array.isArray(content)) {
    return [];
  }

  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const block = part as ContentBlock;
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }

  return parts;
};

const extractThinkingParts = (content: unknown): string[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const block = part as ContentBlock;
    if (block.type === "thinking" && typeof block.thinking === "string") {
      parts.push(block.thinking);
    }
  }

  return parts;
};

const extractToolCallLines = (content: unknown): string[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  const toolCalls: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const block = part as ContentBlock;
    if (block.type !== "toolCall" || typeof block.name !== "string") {
      continue;
    }

    toolCalls.push(
      `Tool call: ${block.name} with args ${JSON.stringify(block.arguments ?? {})}`,
    );
  }

  return toolCalls;
};

const extractToolResultLines = (entry: SessionEntry): string[] => {
  if (entry.type !== "message" || entry.message?.role !== "toolResult") {
    return [];
  }

  const toolName = entry.message.toolName ?? "tool";
  const textParts = extractTextParts(entry.message.content);
  if (textParts.length === 0) {
    return [`Tool result (${toolName}): (no text output)`];
  }

  const rawOutput = textParts.join("\n").trim();
  const cappedOutput = truncateText(rawOutput, {
    maxLines: TOOL_OUTPUT_MAX_LINES,
    maxChars: TOOL_OUTPUT_MAX_CHARS,
    suffix: "… (tool output truncated for quiz prompt)",
  });

  return [`Tool result (${toolName}):\n${cappedOutput}`];
};

const buildConversationText = (entries: SessionEntry[]): string => {
  const sections: string[] = [];

  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message?.role) {
      continue;
    }

    const role = entry.message.role;
    const isUser = role === "user";
    const isAssistant = role === "assistant";
    const isToolResult = role === "toolResult";
    const isCustom = role === "custom";

    const entryLines: string[] = [];

    if (isUser || isAssistant || isCustom) {
      const roleLabel = isUser
        ? "User"
        : isAssistant
          ? "Assistant"
          : "Extension";
      const textParts = extractTextParts(entry.message.content);
      const messageText = textParts.join("\n").trim();
      if (messageText.length > 0) {
        entryLines.push(`${roleLabel}: ${messageText}`);
      }
    }

    if (isAssistant) {
      const thinkingParts = extractThinkingParts(entry.message.content);
      const thinkingText = truncateText(thinkingParts.join("\n"), {
        maxLines: THINKING_MAX_LINES,
        maxChars: THINKING_MAX_CHARS,
        suffix: "… (assistant thinking truncated)",
      });
      if (thinkingText.length > 0) {
        entryLines.push(`Assistant thinking summary: ${thinkingText}`);
      }
      entryLines.push(...extractToolCallLines(entry.message.content));
    }

    if (isToolResult) {
      entryLines.push(...extractToolResultLines(entry));
    }

    if (entryLines.length > 0) {
      sections.push(entryLines.join("\n"));
    }
  }

  return sections.join("\n\n");
};

const loadQuizInstructions = async (): Promise<string> => {
  const contents = await readFile(QUIZ_PROMPT_PATH, "utf8");
  return contents.trim();
};

const showMarkdownPanel = async (
  title: string,
  body: string,
  ctx: ExtensionContext,
  helperText: string,
): Promise<boolean> => {
  return ctx.ui.custom<boolean>((tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));
    const mdTheme = getMarkdownTheme();

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
    container.addChild(new Markdown(body, 1, 1, mdTheme));
    container.addChild(new Text(theme.fg("dim", helperText), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "enter")) {
          done(true);
          return;
        }
        if (matchesKey(data, "escape")) {
          done(false);
        }
      },
    };
  });
};

type QuestionAction = "edit" | "next" | "prev" | "finish" | "cancel";

const showQuestionPanel = async (
  title: string,
  body: string,
  ctx: ExtensionContext,
  helperText: string,
): Promise<QuestionAction> => {
  return ctx.ui.custom<QuestionAction>((tui, theme, _kb, done) => {
    const container = new Container();
    const border = new DynamicBorder((s: string) => theme.fg("accent", s));
    const mdTheme = getMarkdownTheme();

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
    container.addChild(new Markdown(body, 1, 1, mdTheme));
    container.addChild(new Text(theme.fg("dim", helperText), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "enter")) {
          done("edit");
          return;
        }
        if (matchesKey(data, "left") || matchesKey(data, "p")) {
          done("prev");
          return;
        }
        if (matchesKey(data, "right") || matchesKey(data, "n")) {
          done("next");
          return;
        }
        if (matchesKey(data, "g")) {
          done("finish");
          return;
        }
        if (matchesKey(data, "escape")) {
          done("cancel");
        }
      },
    };
  });
};

const runQuiz = async (ctx: ExtensionContext): Promise<void> => {
  const debugLogger = createQuizmeDebugLogger();
  const logSnapshot = async (snapshot: Record<string, unknown>) => {
    try {
      await debugLogger.log(snapshot);
    } catch {
      // Ignore debug logging failures to avoid breaking the command.
    }
  };

  await logSnapshot({ hasUI: ctx.hasUI });

  if (!ctx.hasUI) {
    return;
  }

  const quizInstructions = await loadQuizInstructions();
  await logSnapshot({ quizInstructions });

  const branch = ctx.sessionManager.getBranch();
  await logSnapshot({ branch });

  const conversationText = buildConversationText(branch);
  await logSnapshot({ conversationText });

  if (!conversationText.trim()) {
    ctx.ui.notify("No conversation text found to quiz on", "warning");
    return;
  }

  ctx.ui.notify("Generating quiz...", "info");
  const active = await getQuizmeModelInfo(ctx.modelRegistry, ctx.model);
  await logSnapshot({ active });
  if (!active) {
    ctx.ui.notify("No active model or API key available", "warning");
    return;
  }

  const quizPrompt = buildQuizPrompt(quizInstructions, conversationText);
  await logSnapshot({ quizPrompt });
  const quizResponse = await completeSimple(
    active.model,
    {
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: quizPrompt }],
          timestamp: Date.now(),
        },
      ],
    },
    { apiKey: active.apiKey },
  );
  await logSnapshot({ quizResponse });

  if (quizResponse.stopReason === "error") {
    ctx.ui.notify(
      `Quiz generation failed: ${quizResponse.errorMessage ?? "Unknown error"}`,
      "error",
    );
    return;
  }

  const quizText = quizResponse.content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
  await logSnapshot({ quizText });

  if (!quizText) {
    ctx.ui.notify("Quiz generation returned empty output", "warning");
    return;
  }

  let quizPayload = parseQuizPayloadWithRepair(quizText);
  await logSnapshot({ quizPayload, quizRepairStage: quizPayload ? "deterministic" : "none" });

  if (!quizPayload) {
    ctx.ui.notify("Quiz output format was unexpected; attempting repair...", "info");

    const quizRepairPrompt = buildQuizRepairPrompt(quizText);
    await logSnapshot({ quizRepairPrompt });

    const quizRepairResponse = await completeSimple(
      active.model,
      {
        systemPrompt: QUIZ_REPAIR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: quizRepairPrompt }],
            timestamp: Date.now(),
          },
        ],
      },
      { apiKey: active.apiKey },
    );
    await logSnapshot({ quizRepairResponse });

    if (quizRepairResponse.stopReason !== "error") {
      const repairedQuizText = quizRepairResponse.content
        .filter(
          (block): block is { type: "text"; text: string } =>
            block.type === "text",
        )
        .map((block) => block.text)
        .join("\n")
        .trim();
      await logSnapshot({ repairedQuizText });

      if (repairedQuizText) {
        quizPayload = parseQuizPayloadWithRepair(repairedQuizText);
        await logSnapshot({ repairedQuizPayload: quizPayload });
      }
    } else {
      await logSnapshot({
        quizRepairError: quizRepairResponse.errorMessage ?? "Unknown error",
      });
    }
  }

  if (!quizPayload) {
    ctx.ui.notify("Quiz output could not be parsed", "warning");
    return;
  }

  const answers = quizPayload.questions.map(() => "");
  await logSnapshot({ answers });

  let questionIndex = 0;
  let wantsToGrade = false;

  while (true) {
    const question = quizPayload.questions[questionIndex];
    const questionBody = formatQuestionMarkdown(
      question,
      questionIndex,
      quizPayload.questions.length,
      answers[questionIndex] ?? "",
    );
    const action = await showQuestionPanel(
      "Quiz Me",
      questionBody,
      ctx,
      "←/→ or p/n to navigate • Enter to answer • g to grade • Esc to cancel",
    );
    await logSnapshot({ questionIndex, action });

    if (action === "cancel") {
      return;
    }

    if (action === "edit") {
      const updated = await ctx.ui.editor(
        `Answer for question ${questionIndex + 1}:`,
        answers[questionIndex] ?? "",
      );
      if (typeof updated === "string") {
        answers[questionIndex] = updated;
        await logSnapshot({ answers });
      }
      continue;
    }

    if (action === "prev") {
      questionIndex = Math.max(0, questionIndex - 1);
      continue;
    }

    if (action === "next") {
      questionIndex = Math.min(
        quizPayload.questions.length - 1,
        questionIndex + 1,
      );
      continue;
    }

    if (action === "finish") {
      wantsToGrade = true;
      break;
    }
  }

  if (!wantsToGrade) {
    return;
  }

  const hasAnswer = answers.some((answer) => answer.trim());
  if (!hasAnswer) {
    ctx.ui.notify("No answers provided", "warning");
    return;
  }

  ctx.ui.notify("Grading answers...", "info");
  const gradingPrompt = buildGradingPrompt(quizPayload, answers);
  await logSnapshot({ gradingPrompt });
  const gradingResponse = await completeSimple(
    active.model,
    {
      systemPrompt: GRADING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: gradingPrompt }],
          timestamp: Date.now(),
        },
      ],
    },
    { apiKey: active.apiKey },
  );
  await logSnapshot({ gradingResponse });

  if (gradingResponse.stopReason === "error") {
    ctx.ui.notify(
      `Grading failed: ${gradingResponse.errorMessage ?? "Unknown error"}`,
      "error",
    );
    return;
  }

  const gradingText = gradingResponse.content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
  await logSnapshot({ gradingText });

  if (!gradingText) {
    ctx.ui.notify("Grading returned empty output", "warning");
    return;
  }

  const gradingPayload = parseGradingPayload(gradingText);
  await logSnapshot({ gradingPayload });

  let gradingMarkdown = "";
  if (gradingPayload) {
    gradingMarkdown = formatGradingResultsMarkdown(quizPayload, gradingPayload);
  } else {
    const ungradedSummary = formatGradingResultsMarkdown(quizPayload, {
      results: quizPayload.questions.map((question) => ({
        id: question.id,
        verdict: "Ungraded",
        explanation:
          "Could not parse the grader output into structured results. See raw grader output below.",
      })),
    });

    gradingMarkdown = [
      ungradedSummary,
      "",
      "---",
      "",
      "### Raw grader output",
      gradingText,
    ].join("\n");

    ctx.ui.notify(
      "Grading output format was unexpected; showing fallback results",
      "warning",
    );
  }

  await logSnapshot({ gradingMarkdown });

  await showMarkdownPanel(
    "Quiz Results",
    gradingMarkdown,
    ctx,
    "Enter or Esc to close",
  );
};

export default function quizme(pi: ExtensionAPI) {
  let shutdownPrompted = false;

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI || shutdownPrompted) {
      return;
    }

    shutdownPrompted = true;
    const confirmed = await ctx.ui.confirm(
      "Quiz before shutdown?",
      "Before I shutdown, would you like me to quiz you on what we did this session?",
    );
    if (!confirmed) {
      return;
    }

    await runQuiz(ctx);
  });

  pi.registerCommand("quizme", {
    description:
      "Generate a quiz about the current session and grade your answers",
    handler: async (_args, ctx) => {
      await runQuiz(ctx);
    },
  });
}
