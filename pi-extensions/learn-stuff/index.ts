/**
 * Learn-Stuff Extension
 *
 * Loads the /learn-stuff prompt text from this extension folder and triggers
 * learn-stuff on key workflow events.
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
  ORIGINAL_OUTPUT_MESSAGE_TYPE,
  buildOriginalOutputReplayMessage,
  extractLatestAssistantText,
  shouldReplayOriginalOutput,
} from "./replay";

const LEARN_STUFF_COMMAND = "/learn-stuff";
const LEARN_STUFF_EVENT = "learn-stuff:trigger";
const LESSONS_MAX_CHARS = 12_000;
const LESSONS_MESSAGE_TYPE = "learn-stuff-lessons";
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

type OriginalOutputReplayDetails = {
  reason?: string;
  chars?: number;
};

type PendingOriginalOutputReplay = {
  text: string;
  reason: string;
};

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item): item is { type: "text"; text: string } => {
      if (!item || typeof item !== "object") return false;
      return (item as { type?: string; text?: unknown }).type === "text";
    })
    .map((item) => item.text)
    .join("\n")
    .trim();
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
  if (details.truncated) {
    parts.push("truncated");
  }
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

function isLearnStuffInput(text: string | undefined): boolean {
  return text?.trim().toLowerCase().startsWith(LEARN_STUFF_COMMAND) ?? false;
}

function getReason(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "external";
  const maybe = payload as LearnStuffTriggerPayload;
  if (!maybe.reason || typeof maybe.reason !== "string") return "external";
  return maybe.reason.trim() || "external";
}

function loadPromptBody(): string | null {
  if (!existsSync(PROMPT_FILE)) return null;
  const raw = readFileSync(PROMPT_FILE, "utf-8");
  const frontmatter = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const body = frontmatter ? raw.slice(frontmatter[0].length) : raw;
  const normalized = body.trim();
  return normalized.length > 0 ? normalized : null;
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
    if (body.length > 0) {
      sections.push(body);
    }
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
    const omittedChars = totalChars - shownChars;
    const summary =
      `[Truncated lessons digest: showing first ${shownChars} of ${totalChars} chars; ` +
      `omitted ${omittedChars} chars.]`;
    const candidate = `${summary}\n\n${content.slice(0, shownChars)}`;
    if (candidate.length <= maxChars) {
      return {
        text: candidate,
        truncated: true,
        totalChars,
        shownChars,
      };
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

export default function learnStuffExtension(pi: ExtensionAPI): void {
  let lastInputText: string | undefined;
  let lastInputSource: "interactive" | "rpc" | "extension" | undefined;
  let currentCtx: ExtensionContext | undefined;
  let warnedMissingPrompt = false;
  let pendingOriginalOutputReplay: PendingOriginalOutputReplay | null = null;

  pi.registerMessageRenderer(
    LESSONS_MESSAGE_TYPE,
    (message, { expanded }, theme) => {
      const details =
        (message.details as LessonsDigestDetails | undefined) ?? {};
      const digestText = messageContentToText(message.content);
      const stats = formatDigestStats(details);
      const title = theme.fg("accent", theme.bold("Lessons digest"));

      let text = title;
      if (stats) {
        text += `\n${theme.fg(details.truncated ? "warning" : "muted", stats)}`;
      }

      if (expanded) {
        if (details.projectRoot) {
          text += `\n${theme.fg("dim", `root ${details.projectRoot}`)}`;
        }
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

  pi.registerMessageRenderer(
    ORIGINAL_OUTPUT_MESSAGE_TYPE,
    (message, { expanded }, theme) => {
      const details =
        (message.details as OriginalOutputReplayDetails | undefined) ?? {};
      const outputText = messageContentToText(message.content);
      const title = theme.fg("accent", theme.bold("Original output"));

      let text = title;
      if (details.reason) {
        text += `\n${theme.fg("muted", `captured before ${details.reason}`)}`;
      }
      if (typeof details.chars === "number") {
        text += `\n${theme.fg("dim", `chars ${details.chars}`)}`;
      }

      if (expanded) {
        text += `\n\n${outputText || theme.fg("dim", "No output captured.")}`;
      } else {
        text += `\n${theme.fg("dim", buildCollapsedPreview(outputText))}`;
        text += `\n${theme.fg("dim", "Expand message to view full output")}`;
      }

      const box = new Box(1, 1, (value) => theme.bg("customMessageBg", value));
      box.addChild(new Text(text, 0, 0));
      return box;
    },
  );

  pi.registerCommand("learn-stuff", {
    description: "Capture lessons into the closest relevant AGENTS.md file(s)",
    handler: async (args, ctx) => {
      const promptBody = loadPromptBody();
      if (!promptBody) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `learn-stuff prompt file missing: ${PROMPT_FILE}`,
            "warning",
          );
        }
        return;
      }

      const reason = args.trim();
      const content = reason
        ? `${promptBody}\n\nTrigger context: ${reason}`
        : promptBody;

      if (ctx.isIdle()) {
        pi.sendUserMessage(content);
      } else {
        pi.sendUserMessage(content, { deliverAs: "followUp" });
      }
    },
  });

  pi.registerCommand("learn-stuff:lessons", {
    description:
      "Merge Lessons sections from project AGENTS.md and inject into context",
    handler: async (_args, ctx) => {
      const projectRoot = findProjectRoot(ctx.cwd);
      const agentsFiles = collectProjectAgentsFiles(projectRoot);
      const filesWithLessons: LessonsByFile[] = [];

      for (const filePath of agentsFiles) {
        try {
          const content = readFileSync(filePath, "utf-8");
          const sections = extractLessonsSections(content);
          if (sections.length > 0) {
            filesWithLessons.push({ path: filePath, sections });
          }
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
        const capped = applyHardCap(fullDigest, LESSONS_MAX_CHARS);
        digestText = capped.text;
        truncated = capped.truncated;
        totalChars = capped.totalChars;
        shownChars = capped.shownChars;
      }

      const message = {
        customType: LESSONS_MESSAGE_TYPE,
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
        },
      } as const;

      if (ctx.isIdle()) {
        pi.sendMessage(message, { triggerTurn: false });
      } else {
        pi.sendMessage(message, { deliverAs: "followUp", triggerTurn: false });
      }
    },
  });

  function rememberContext(ctx: ExtensionContext): void {
    currentCtx = ctx;
  }

  function hasLearnStuffCommand(): boolean {
    return pi.getCommands().some((command) => command.name === "learn-stuff");
  }

  function isLoopActive(ctx: ExtensionContext): boolean {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as {
        type?: string;
        customType?: string;
        data?: { active?: boolean };
      };
      if (entry.type !== "custom" || entry.customType !== "loop-state")
        continue;
      return Boolean(entry.data?.active);
    }
    return false;
  }

  function flushPendingOriginalOutputReplay(ctx: ExtensionContext): void {
    if (!pendingOriginalOutputReplay) return;

    const pending = pendingOriginalOutputReplay;
    pendingOriginalOutputReplay = null;
    const message = buildOriginalOutputReplayMessage(
      pending.text,
      pending.reason,
    );

    if (ctx.isIdle()) {
      pi.sendMessage(message, { triggerTurn: false });
      return;
    }

    pi.sendMessage(message, { deliverAs: "followUp", triggerTurn: false });
  }

  function triggerLearnStuff(reason: string, ctx: ExtensionContext): boolean {
    if (!hasLearnStuffCommand()) {
      if (!warnedMissingPrompt && ctx.hasUI) {
        warnedMissingPrompt = true;
        ctx.ui.notify(
          "learn-stuff hook: /learn-stuff command not available",
          "warning",
        );
      }
      return false;
    }

    warnedMissingPrompt = false;
    const command = `${LEARN_STUFF_COMMAND} ${reason}`.trim();

    try {
      if (ctx.isIdle()) {
        pi.sendUserMessage(command);
      } else {
        pi.sendUserMessage(command, { deliverAs: "followUp" });
      }
      return true;
    } catch (error) {
      if (ctx.hasUI) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`learn-stuff hook failed: ${message}`, "warning");
      }
      return false;
    }
  }

  pi.events.on(LEARN_STUFF_EVENT, (payload) => {
    if (!currentCtx) return;
    if (isLearnStuffInput(lastInputText)) return;
    triggerLearnStuff(getReason(payload), currentCtx);
  });

  pi.on("session_start", async (_event, ctx) => {
    pendingOriginalOutputReplay = null;
    rememberContext(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    pendingOriginalOutputReplay = null;
    rememberContext(ctx);
  });

  pi.on("input", async (event, ctx) => {
    lastInputText = event.text;
    lastInputSource = event.source;
    const isExtensionLearnStuffInput =
      event.source === "extension" && isLearnStuffInput(event.text);
    if (!isExtensionLearnStuffInput) {
      pendingOriginalOutputReplay = null;
    }
    rememberContext(ctx);
  });

  pi.on("session_fork", async (_event, ctx) => {
    pendingOriginalOutputReplay = null;
    rememberContext(ctx);
    triggerLearnStuff("fork", ctx);
  });

  pi.on("agent_end", async (event, ctx) => {
    rememberContext(ctx);

    if (
      shouldReplayOriginalOutput({
        hasPendingMessages: ctx.hasPendingMessages(),
        hasPendingReplayText: Boolean(pendingOriginalOutputReplay?.text),
        lastInputSource,
        lastInputText,
      })
    ) {
      flushPendingOriginalOutputReplay(ctx);
      return;
    }

    if (ctx.hasPendingMessages()) return;
    if (lastInputSource === "extension") return;
    if (isLearnStuffInput(lastInputText)) return;
    if (isLoopActive(ctx)) return;

    const capturedOutput = extractLatestAssistantText(event);
    pendingOriginalOutputReplay = capturedOutput
      ? { text: capturedOutput, reason: "session_end" }
      : null;

    const triggered = triggerLearnStuff("session_end", ctx);
    if (!triggered) {
      pendingOriginalOutputReplay = null;
    }
  });
}
