/**
 * Learn-Stuff Extension
 *
 * Captures durable lessons into AGENTS.md files when interesting events happen,
 * supports manual capture, and aggregates Lessons sections across a project.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import {
  buildInterestingEventReasons,
  isLikelyUserCorrection,
  mergeInterestingReasons,
  reasonFromUserCorrection,
} from "./interesting-events";
import {
  extractLessonsSummary,
  formatInsightLessonsBlock,
} from "./lessons-format";

const LEARN_STUFF_COMMAND = "/learn-stuff";
const LEARN_STUFF_EVENT = "learn-stuff:trigger";
const LESSONS_DIGEST_MAX_CHARS = 12_000;
const LESSONS_DIGEST_MESSAGE_TYPE = "learn-stuff-lessons-digest";
const LESSONS_MESSAGE_TYPE = "learn-stuff-lessons";
const INSIGHT_BLOCK_LABEL = "★ Lessons";
const MAX_AUTO_REASON_CHARS = 2_000;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".jj",
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "target",
  "coverage",
]);

const baseDir = dirname(fileURLToPath(import.meta.url));
const PROMPT_FILE = join(baseDir, "prompt.md");

type LearnStuffInputSource = "interactive" | "rpc" | "extension" | undefined;
type LearnStuffRunSource = "manual" | "automatic" | "event";

type LearnStuffTriggerPayload = {
  reason?: string;
};

type LessonsByFile = {
  path: string;
  sections: string[];
};

type LessonsDigestDetails = {
  projectRoot?: string;
  scannedAgentsFiles?: number;
  filesWithLessons?: number;
  lessonsSections?: number;
  truncated?: boolean;
  totalChars?: number;
  shownChars?: number;
};

type LessonsMessageDetails = {
  source?: LearnStuffRunSource;
  reason?: string;
};

type ActiveLearnStuffRun = {
  source: LearnStuffRunSource;
  reason: string;
};

type AgentEndMessageLike = {
  role?: string;
  content?: unknown;
};

type AgentEndEventLike = {
  messages?: AgentEndMessageLike[];
};

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((item): item is { type: "text"; text: string } => {
      if (!item || typeof item !== "object") return false;
      const part = item as { type?: string; text?: unknown };
      return part.type === "text" && typeof part.text === "string";
    })
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

function isLearnStuffCommandInput(text: string | undefined): boolean {
  return text?.trim().toLowerCase().startsWith(LEARN_STUFF_COMMAND) ?? false;
}

function getReason(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "external trigger";
  const maybe = payload as LearnStuffTriggerPayload;
  if (typeof maybe.reason !== "string") return "external trigger";
  return maybe.reason.trim() || "external trigger";
}

function extractLatestAssistantText(event: AgentEndEventLike): string | null {
  if (!Array.isArray(event.messages)) return null;
  for (let i = event.messages.length - 1; i >= 0; i--) {
    const message = event.messages[i];
    if (message.role !== "assistant") continue;
    const text = messageContentToText(message.content);
    if (text.length > 0) return text;
  }
  return null;
}

function loadPromptBody(): string | null {
  if (!existsSync(PROMPT_FILE)) return null;
  const raw = readFileSync(PROMPT_FILE, "utf-8");
  const frontmatter = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const body = frontmatter ? raw.slice(frontmatter[0].length) : raw;
  const normalized = body.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDigestStats(details: LessonsDigestDetails): string | null {
  const parts: string[] = [];
  if (
    typeof details.filesWithLessons === "number" &&
    typeof details.scannedAgentsFiles === "number"
  ) {
    parts.push(
      `files ${details.filesWithLessons}/${details.scannedAgentsFiles}`,
    );
  }
  if (typeof details.lessonsSections === "number") {
    parts.push(`sections ${details.lessonsSections}`);
  }
  if (
    typeof details.shownChars === "number" &&
    typeof details.totalChars === "number"
  ) {
    parts.push(`chars ${details.shownChars}/${details.totalChars}`);
  }
  if (details.truncated) parts.push("truncated");
  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildCollapsedPreview(content: string): string {
  if (!content.trim()) return "No digest content.";
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2);
  const preview = lines.join("\n");
  if (preview.length <= 220) return preview;
  return `${preview.slice(0, 217)}...`;
}

function findProjectRoot(startDir: string): string {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, ".git")) || existsSync(join(current, ".jj"))) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}

function shouldSkipDirectory(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name);
}

function collectProjectAgentsFiles(projectRoot: string): string[] {
  const files: string[] = [];
  const stack = [projectRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === "AGENTS.md") {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function isLessonsHeading(line: string): { level: number; isLessons: boolean } {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!match) return { level: 0, isLessons: false };

  const level = match[1].length;
  const headingText = match[2]
    .trim()
    .toLowerCase()
    .replace(/[\`*_]/g, "")
    .replace(/\s*:+\s*$/, "")
    .trim();
  return { level, isLessons: headingText.startsWith("lessons") };
}

function extractLessonsSections(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const sections: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const startHeading = isLessonsHeading(lines[index]);
    if (!startHeading.isLessons) {
      index++;
      continue;
    }

    const start = index + 1;
    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
      const maybeHeading = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!maybeHeading) continue;
      const level = maybeHeading[1].length;
      if (level <= startHeading.level) {
        end = i;
        break;
      }
    }

    const body = lines.slice(start, end).join("\n").trim();
    if (body.length > 0) sections.push(body);
    index = end;
  }

  return sections;
}

function buildLessonsDigest(
  projectRoot: string,
  filesWithLessons: LessonsByFile[],
): string {
  const sectionCount = filesWithLessons.reduce(
    (sum, file) => sum + file.sections.length,
    0,
  );
  const header = [
    "Repository lessons digest from AGENTS.md files.",
    `Project root: ${projectRoot}`,
    `Files with lessons: ${filesWithLessons.length}`,
    `Lessons sections: ${sectionCount}`,
  ].join("\n");

  const sections = filesWithLessons.map((file) => {
    const relPath = relative(projectRoot, file.path) || "AGENTS.md";
    const merged = file.sections.join("\n\n").trim();
    return `## ${relPath}\n${merged}`;
  });

  return `${header}\n\n${sections.join("\n\n")}`.trim();
}

function applyHardCap(
  content: string,
  maxChars: number,
): {
  text: string;
  truncated: boolean;
  totalChars: number;
  shownChars: number;
} {
  const totalChars = content.length;
  if (totalChars <= maxChars) {
    return {
      text: content,
      truncated: false,
      totalChars,
      shownChars: totalChars,
    };
  }

  let shownChars = Math.min(totalChars, maxChars);
  while (shownChars >= 0) {
    const omitted = totalChars - shownChars;
    const summary = `[Truncated lessons digest: showing first ${shownChars} of ${totalChars} chars; omitted ${omitted} chars.]`;
    const candidate = `${summary}\n\n${content.slice(0, shownChars)}`;
    if (candidate.length <= maxChars) {
      return { text: candidate, truncated: true, totalChars, shownChars };
    }
    shownChars--;
  }

  return {
    text: content.slice(0, maxChars),
    truncated: true,
    totalChars,
    shownChars: maxChars,
  };
}

function buildLearnStuffPrompt(promptBody: string, reason: string): string {
  const contextLine = reason.trim()
    ? `Trigger context: ${reason.trim()}`
    : "Trigger context: manual request";
  return [
    promptBody,
    contextLine,
    "Output requirements:",
    "- Provide a concise execution summary.",
    "- Include a `## Lessons` section with at most two sentences describing durable lessons.",
  ].join("\n\n");
}

function pushMessage(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  message: {
    customType: string;
    content: string;
    display: true;
    details?: Record<string, unknown>;
  },
): void {
  if (ctx.isIdle()) {
    pi.sendMessage(message, { triggerTurn: false });
    return;
  }
  pi.sendMessage(message, { deliverAs: "followUp", triggerTurn: false });
}

export default function learnStuffExtension(pi: ExtensionAPI): void {
  let currentCtx: ExtensionContext | undefined;
  let lastInputText: string | undefined;
  let lastInputSource: LearnStuffInputSource;
  let pendingInterestingReasons: string[] = [];
  let activeLearnStuffRun: ActiveLearnStuffRun | null = null;

  function rememberContext(ctx: ExtensionContext): void {
    currentCtx = ctx;
  }

  function queueReasons(reasons: string[]): void {
    pendingInterestingReasons = mergeInterestingReasons(
      pendingInterestingReasons,
      reasons,
    );
  }

  function drainReasons(maxChars: number): string {
    const joined = normalizeWhitespace(pendingInterestingReasons.join(" | "));
    pendingInterestingReasons = [];
    return truncate(joined, maxChars);
  }

  function emitLessonsInsight(
    outputText: string,
    run: ActiveLearnStuffRun,
    ctx: ExtensionContext,
  ): void {
    const lessonSummary = extractLessonsSummary(outputText);
    const block = formatInsightLessonsBlock(lessonSummary);
    if (!block.includes(INSIGHT_BLOCK_LABEL)) return;

    pushMessage(pi, ctx, {
      customType: LESSONS_MESSAGE_TYPE,
      content: block,
      display: true,
      details: {
        source: run.source,
        reason: run.reason,
      } satisfies LessonsMessageDetails,
    });
  }

  function runLearnStuffCapture(
    reason: string,
    source: LearnStuffRunSource,
    ctx: ExtensionContext,
  ): boolean {
    const promptBody = loadPromptBody();
    if (!promptBody) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          `learn-stuff prompt file missing: ${PROMPT_FILE}`,
          "warning",
        );
      }
      return false;
    }

    if (activeLearnStuffRun) {
      queueReasons([`Deferred learn-stuff trigger (${source}): ${reason}`]);
      return false;
    }

    const prompt = buildLearnStuffPrompt(promptBody, reason);
    activeLearnStuffRun = {
      source,
      reason: reason.trim() || source,
    };

    try {
      if (ctx.isIdle()) {
        pi.sendUserMessage(prompt);
      } else {
        pi.sendUserMessage(prompt, { deliverAs: "followUp" });
      }
      return true;
    } catch (error) {
      activeLearnStuffRun = null;
      if (ctx.hasUI) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`learn-stuff trigger failed: ${message}`, "warning");
      }
      return false;
    }
  }

  pi.registerMessageRenderer(LESSONS_MESSAGE_TYPE, (message, _state, theme) => {
    const text = messageContentToText(message.content);
    const box = new Box(1, 1, (value) => theme.bg("customMessageBg", value));
    box.addChild(new Text(text, 0, 0));
    return box;
  });

  pi.registerMessageRenderer(
    LESSONS_DIGEST_MESSAGE_TYPE,
    (message, { expanded }, theme) => {
      const details =
        (message.details as LessonsDigestDetails | undefined) ?? {};
      const digestText = messageContentToText(message.content);
      const stats = formatDigestStats(details);
      const title = theme.fg("accent", theme.bold("Lessons digest"));

      let text = title;
      if (stats)
        text += `\n${theme.fg(details.truncated ? "warning" : "muted", stats)}`;

      if (expanded) {
        if (details.projectRoot)
          text += `\n${theme.fg("dim", `root ${details.projectRoot}`)}`;
        text += `\n\n${digestText || theme.fg("dim", "No digest content.")}`;
      } else {
        text += `\n${theme.fg("dim", buildCollapsedPreview(digestText))}`;
        text += `\n${theme.fg("dim", "Expand message to view full digest")}`;
      }

      const box = new Box(1, 1, (value) => theme.bg("customMessageBg", value));
      box.addChild(new Text(text, 0, 0));
      return box;
    },
  );

  pi.registerCommand("learn-stuff", {
    description: "Capture durable lessons into relevant AGENTS.md files",
    handler: async (args, ctx) => {
      rememberContext(ctx);
      const reason = args.trim() || "manual learn-stuff request";
      runLearnStuffCapture(reason, "manual", ctx);
    },
  });

  pi.registerCommand("learn-stuff:lessons", {
    description: "Aggregate Lessons sections from all project AGENTS.md files",
    handler: async (_args, ctx) => {
      rememberContext(ctx);
      const projectRoot = findProjectRoot(ctx.cwd);
      const agentsFiles = collectProjectAgentsFiles(projectRoot);
      const filesWithLessons: LessonsByFile[] = [];

      for (const filePath of agentsFiles) {
        try {
          const content = readFileSync(filePath, "utf-8");
          const sections = extractLessonsSections(content);
          if (sections.length > 0)
            filesWithLessons.push({ path: filePath, sections });
        } catch {
          continue;
        }
      }

      const sectionCount = filesWithLessons.reduce(
        (sum, file) => sum + file.sections.length,
        0,
      );
      let digestText: string;
      let truncated = false;
      let totalChars = 0;
      let shownChars = 0;

      if (agentsFiles.length === 0) {
        digestText = `No AGENTS.md files found under project root: ${projectRoot}`;
        totalChars = digestText.length;
        shownChars = totalChars;
      } else if (filesWithLessons.length === 0) {
        digestText =
          `Found ${agentsFiles.length} AGENTS.md file(s) under ${projectRoot}, ` +
          "but none contained a Lessons section.";
        totalChars = digestText.length;
        shownChars = totalChars;
      } else {
        const fullDigest = buildLessonsDigest(projectRoot, filesWithLessons);
        const capped = applyHardCap(fullDigest, LESSONS_DIGEST_MAX_CHARS);
        digestText = capped.text;
        truncated = capped.truncated;
        totalChars = capped.totalChars;
        shownChars = capped.shownChars;
      }

      pushMessage(pi, ctx, {
        customType: LESSONS_DIGEST_MESSAGE_TYPE,
        content: digestText,
        display: true,
        details: {
          projectRoot,
          scannedAgentsFiles: agentsFiles.length,
          filesWithLessons: filesWithLessons.length,
          lessonsSections: sectionCount,
          truncated,
          totalChars,
          shownChars,
        } satisfies LessonsDigestDetails,
      });
    },
  });

  pi.events.on(LEARN_STUFF_EVENT, (payload) => {
    if (!currentCtx) return;
    const reason = getReason(payload);
    if (!runLearnStuffCapture(reason, "event", currentCtx)) {
      queueReasons([`Event trigger: ${reason}`]);
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    rememberContext(ctx);
    pendingInterestingReasons = [];
    activeLearnStuffRun = null;
  });

  pi.on("session_switch", async (_event, ctx) => {
    rememberContext(ctx);
    pendingInterestingReasons = [];
    activeLearnStuffRun = null;
  });

  pi.on("input", async (event, ctx) => {
    rememberContext(ctx);
    lastInputText = event.text;
    lastInputSource = event.source;

    if (event.source === "extension") return;
    if (isLikelyUserCorrection(event.text)) {
      queueReasons([reasonFromUserCorrection(event.text)]);
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    rememberContext(ctx);
    const reasons = buildInterestingEventReasons({
      toolName: event.toolName,
      isError: event.isError,
      content: event.content,
    });
    if (reasons.length > 0) queueReasons(reasons);
  });

  pi.on("agent_end", async (event, ctx) => {
    rememberContext(ctx);

    if (activeLearnStuffRun) {
      const run = activeLearnStuffRun;
      activeLearnStuffRun = null;

      const output = extractLatestAssistantText(event);
      if (output) emitLessonsInsight(output, run, ctx);

      if (pendingInterestingReasons.length > 0) {
        const queuedReason = drainReasons(MAX_AUTO_REASON_CHARS);
        runLearnStuffCapture(queuedReason, "automatic", ctx);
      }
      return;
    }

    if (ctx.hasPendingMessages()) return;
    if (lastInputSource === "extension") return;
    if (isLearnStuffCommandInput(lastInputText)) return;
    if (pendingInterestingReasons.length === 0) return;

    const reason = drainReasons(MAX_AUTO_REASON_CHARS);
    runLearnStuffCapture(reason, "automatic", ctx);
  });
}
