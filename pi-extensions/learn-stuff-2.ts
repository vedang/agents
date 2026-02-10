/**
 * Learn-Stuff-2 Extension
 *
 * Lessons-oriented output style with automatic persistence.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import {
	dirname,
	isAbsolute,
	join,
	normalize,
	relative,
	resolve,
} from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const LEARN_STUFF_2_MODE_SENTINEL = "You are in 'learn-stuff-2' mode";
const SHOW_LESSONS_COMMAND = "learn-stuff:show-lessons";
const ADD_LESSON_COMMAND = "learn-stuff:add-lesson";
const LESSONS_BLOCK_LABEL = "★ Lessons";
const LESSONS_BLOCK_DIVIDER =
	"─────────────────────────────────────────────────";
const SHOW_LESSONS_MESSAGE_TYPE = "learn-stuff-2-show-lessons";
const SHOW_LESSONS_MAX_CHARS = 12_000;
const LESSONS_FUZZY_JACCARD_THRESHOLD = 0.86;
const LESSONS_MIN_FUZZY_TOKENS = 4;
const LESSONS_MIN_FUZZY_INTERSECTION = 3;
const SKIPPED_DIRECTORIES = new Set([
	".git",
	".jj",
	"node_modules",
	"dist",
	"build",
	"target",
	"coverage",
	".next",
	".nuxt",
]);
const LESSON_STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"for",
	"from",
	"in",
	"into",
	"is",
	"it",
	"of",
	"on",
	"or",
	"that",
	"the",
	"their",
	"them",
	"these",
	"this",
	"those",
	"to",
	"with",
	"without",
	"each",
	"per",
]);

type AgentEndMessageLike = {
	role?: string;
	content?: unknown;
};

type LessonsByFile = {
	path: string;
	sections: string[];
};

type LessonSignature = {
	normalized: string;
	canonicalKey: string;
	tokens: string[];
};

export const LEARN_STUFF_2_ADDITIONAL_CONTEXT = `${LEARN_STUFF_2_MODE_SENTINEL}, where you should include a concise lessons block alongside your normal response.

After each response, include this block format (with backticks):
"\`★ Lessons ─────────────────────────────────────\`
- [2-3 concise lessons learned from this step]
\`─────────────────────────────────────────────────\`"

Keep the lessons specific to the code change or debugging step. The extension runtime persists lessons separately, so do not include persistence chatter in the response.`; // [tag:learn_stuff_2_lessons_block_format]

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function stripWrappingBackticks(line: string): string {
	return line
		.trim()
		.replace(/^`+|`+$/g, "")
		.trim();
}

function normalizeLesson(lesson: string): string {
	return normalizeWhitespace(
		stripWrappingBackticks(lesson).replace(/^[-*]\s+/, ""),
	);
}

function stemLessonToken(token: string): string {
	if (token.length > 5 && token.endsWith("ing")) {
		return token.slice(0, -3);
	}
	if (token.length > 4 && token.endsWith("ed")) {
		return token.slice(0, -2);
	}
	if (token.length > 3 && token.endsWith("s")) {
		return token.slice(0, -1);
	}
	return token;
}

function canonicalTokens(lesson: string): string[] {
	const rawTokens = lesson
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0)
		.map(stemLessonToken)
		.filter((token) => token.length > 1)
		.filter((token) => !LESSON_STOPWORDS.has(token));

	return [...new Set(rawTokens)].sort((left, right) =>
		left.localeCompare(right),
	);
}

function buildLessonSignature(lesson: string): LessonSignature {
	const normalized = normalizeLesson(lesson);
	const tokens = canonicalTokens(normalized);
	return {
		normalized,
		canonicalKey: tokens.join(" "),
		tokens,
	};
}

function jaccardSimilarity(
	leftTokens: string[],
	rightTokens: string[],
): number {
	if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

	const rightSet = new Set(rightTokens);
	let intersection = 0;
	for (const token of leftTokens) {
		if (rightSet.has(token)) intersection++;
	}

	const union = leftTokens.length + rightTokens.length - intersection;
	if (union <= 0) return 0;
	return intersection / union;
}

function isFuzzyDuplicate(
	left: LessonSignature,
	right: LessonSignature,
): boolean {
	if (left.tokens.length < LESSONS_MIN_FUZZY_TOKENS) return false;
	if (right.tokens.length < LESSONS_MIN_FUZZY_TOKENS) return false;

	const rightSet = new Set(right.tokens);
	let intersection = 0;
	for (const token of left.tokens) {
		if (rightSet.has(token)) intersection++;
	}

	if (intersection < LESSONS_MIN_FUZZY_INTERSECTION) return false;
	return (
		jaccardSimilarity(left.tokens, right.tokens) >=
		LESSONS_FUZZY_JACCARD_THRESHOLD
	);
}

function areLessonsEquivalent(
	left: LessonSignature,
	right: LessonSignature,
): boolean {
	if (!left.normalized || !right.normalized) return false;
	if (left.normalized === right.normalized) return true;
	if (
		left.canonicalKey.length > 0 &&
		left.canonicalKey === right.canonicalKey
	) {
		return true;
	}
	return isFuzzyDuplicate(left, right);
}

function dedupeLessons(lessons: string[]): string[] {
	const seen: LessonSignature[] = [];
	const unique: string[] = [];

	for (const lesson of lessons) {
		const signature = buildLessonSignature(lesson);
		if (!signature.normalized) continue;
		if (seen.some((existing) => areLessonsEquivalent(signature, existing))) {
			continue;
		}
		seen.push(signature);
		unique.push(signature.normalized);
	}

	return unique;
}

function messageContentToText(content: unknown): string {
	if (!Array.isArray(content)) return "";

	return content
		.filter((part): part is { type: "text"; text: string } => {
			if (!part || typeof part !== "object") return false;
			const candidate = part as { type?: string; text?: unknown };
			return candidate.type === "text" && typeof candidate.text === "string";
		})
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function extractLatestAssistantOutput(
	messages: AgentEndMessageLike[] | undefined,
): string | null {
	if (!Array.isArray(messages)) return null;

	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role !== "assistant") continue;
		const text = messageContentToText(message.content);
		if (text.length > 0) return text;
	}

	return null;
}

export function extractLessonsFromAssistantOutput(output: string): string[] {
	const lines = output.split(/\r?\n/);
	const startIndex = lines.findIndex((line) =>
		stripWrappingBackticks(line).includes(LESSONS_BLOCK_LABEL),
	);
	if (startIndex < 0) return [];

	let endIndex = lines.length;
	for (let index = startIndex + 1; index < lines.length; index++) {
		const cleaned = stripWrappingBackticks(lines[index]);
		if (!cleaned) continue;
		if (
			cleaned.includes(LESSONS_BLOCK_DIVIDER) ||
			/^[-─]{12,}$/.test(cleaned)
		) {
			endIndex = index;
			break;
		}
	}

	const rawLessons = lines
		.slice(startIndex + 1, endIndex)
		.map((line) => stripWrappingBackticks(line))
		.filter((line) => line.length > 0)
		.map((line) => {
			const bulletMatch = line.match(/^[-*]\s+(.+)$/);
			return bulletMatch ? bulletMatch[1] : line;
		});

	return dedupeLessons(rawLessons);
}

function normalizeHeadingText(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/[`*_]/g, "")
		.replace(/\s*:+\s*$/, "")
		.trim();
}

function parseHeading(line: string): { level: number; text: string } | null {
	const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
	if (!match) return null;
	return {
		level: match[1].length,
		text: normalizeHeadingText(match[2]),
	};
}

function findFirstLessonsSectionBounds(
	lines: string[],
): { headingIndex: number; sectionEnd: number } | null {
	let headingIndex = -1;
	let headingLevel = 0;

	for (let index = 0; index < lines.length; index++) {
		const heading = parseHeading(lines[index]);
		if (!heading) continue;

		if (headingIndex < 0) {
			if (heading.text.startsWith("lessons")) {
				headingIndex = index;
				headingLevel = heading.level;
			}
			continue;
		}

		if (heading.level <= headingLevel) {
			return { headingIndex, sectionEnd: index };
		}
	}

	if (headingIndex < 0) return null;
	return { headingIndex, sectionEnd: lines.length };
}

export function extractLessonsSectionsFromAgentsContent(
	content: string,
): string[] {
	const lines = content.split(/\r?\n/);
	const sections: string[] = [];

	let index = 0;
	while (index < lines.length) {
		const heading = parseHeading(lines[index]);
		if (!heading || !heading.text.startsWith("lessons")) {
			index++;
			continue;
		}

		let sectionEnd = lines.length;
		for (let cursor = index + 1; cursor < lines.length; cursor++) {
			const maybeHeading = parseHeading(lines[cursor]);
			if (!maybeHeading) continue;
			if (maybeHeading.level <= heading.level) {
				sectionEnd = cursor;
				break;
			}
		}

		const body = lines
			.slice(index + 1, sectionEnd)
			.join("\n")
			.trim();
		if (body.length > 0) sections.push(body);
		index = sectionEnd;
	}

	return sections;
}

function collectLessonSignaturesInSectionLines(
	sectionLines: string[],
): LessonSignature[] {
	const existing: LessonSignature[] = [];

	for (const line of sectionLines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
		if (!bulletMatch) continue;
		const signature = buildLessonSignature(bulletMatch[1]);
		if (!signature.normalized) continue;
		existing.push(signature);
	}

	return existing;
}

export function mergeLessonsIntoAgentsContent(
	existingContent: string,
	lessons: string[],
): { content: string; addedCount: number } {
	const uniqueLessons = dedupeLessons(lessons);
	if (uniqueLessons.length === 0) {
		return { content: existingContent, addedCount: 0 };
	}

	const lines =
		existingContent.length > 0 ? existingContent.split(/\r?\n/) : [];
	const sectionBounds = findFirstLessonsSectionBounds(lines);

	if (!sectionBounds) {
		const sectionLines = [
			"## Lessons",
			"",
			...uniqueLessons.map((lesson) => `- ${lesson}`),
		];
		const base = existingContent.trimEnd();
		const merged =
			base.length > 0
				? `${base}\n\n${sectionLines.join("\n")}`
				: sectionLines.join("\n");
		return { content: merged, addedCount: uniqueLessons.length };
	}

	const sectionLines = lines.slice(
		sectionBounds.headingIndex + 1,
		sectionBounds.sectionEnd,
	);
	const existingLessons = collectLessonSignaturesInSectionLines(sectionLines);
	const lessonsToAdd: string[] = [];

	for (const lesson of uniqueLessons) {
		const signature = buildLessonSignature(lesson);
		if (!signature.normalized) continue;

		if (
			existingLessons.some((existing) =>
				areLessonsEquivalent(signature, existing),
			)
		) {
			continue;
		}

		existingLessons.push(signature);
		lessonsToAdd.push(signature.normalized);
	}

	if (lessonsToAdd.length === 0) {
		return { content: existingContent, addedCount: 0 };
	}

	const mergedLines = [
		...lines.slice(0, sectionBounds.sectionEnd),
		...lessonsToAdd.map((lesson) => `- ${lesson}`),
		...lines.slice(sectionBounds.sectionEnd),
	];

	return {
		content: mergedLines.join("\n"),
		addedCount: lessonsToAdd.length,
	};
}

function normalizeToolPath(pathValue: string, cwd: string): string {
	const trimmed = pathValue
		.trim()
		.replace(/^['"]|['"]$/g, "")
		.replace(/^@/, "");
	if (!trimmed) return "";
	return normalize(isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed));
}

function isPathInsideRoot(pathValue: string, root: string): boolean {
	const rel = relative(root, pathValue);
	if (rel === "") return true;
	return !rel.startsWith("..") && !isAbsolute(rel);
}

export function resolveNearestAgentsPathForModifiedFile(
	modifiedFilePath: string,
	projectRoot: string,
	hasAgentsFile: (path: string) => boolean = existsSync,
): string {
	const root = resolve(projectRoot);
	const absoluteFilePath = resolve(modifiedFilePath);
	const fileDirectory = dirname(absoluteFilePath);
	const allowRootMatch = fileDirectory === root;

	let cursor = fileDirectory;
	if (isPathInsideRoot(fileDirectory, root)) {
		while (true) {
			const candidate = join(cursor, "AGENTS.md");
			if (hasAgentsFile(candidate)) {
				if (allowRootMatch || cursor !== root) {
					return candidate;
				}
			}

			if (cursor === root) break;
			const parent = resolve(cursor, "..");
			if (parent === cursor) break;
			cursor = parent;
		}
	}

	return join(fileDirectory, "AGENTS.md");
}

function findProjectRoot(startDir: string): string {
	let cursor = resolve(startDir);
	while (true) {
		if (existsSync(join(cursor, ".git")) || existsSync(join(cursor, ".jj"))) {
			return cursor;
		}
		const parent = resolve(cursor, "..");
		if (parent === cursor) return resolve(startDir);
		cursor = parent;
	}
}

function collectAgentsFiles(projectRoot: string): string[] {
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
				if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
				stack.push(fullPath);
				continue;
			}
			if (entry.isFile() && entry.name === "AGENTS.md") {
				files.push(fullPath);
			}
		}
	}

	return files.sort((left, right) => left.localeCompare(right));
}

function buildLessonsDigest(
	projectRoot: string,
	lessonsByFile: LessonsByFile[],
): string {
	const sectionCount = lessonsByFile.reduce(
		(sum, file) => sum + file.sections.length,
		0,
	);
	const header = [
		"Lessons digest from AGENTS.md files.",
		`Project root: ${projectRoot}`,
		`Files with lessons: ${lessonsByFile.length}`,
		`Lessons sections: ${sectionCount}`,
	].join("\n");

	const sections = lessonsByFile.map((file) => {
		const relPath = relative(projectRoot, file.path) || "AGENTS.md";
		return `## ${relPath}\n${file.sections.join("\n\n").trim()}`;
	});

	return `${header}\n\n${sections.join("\n\n")}`.trim();
}

function capDigest(content: string, maxChars: number): string {
	if (content.length <= maxChars) return content;
	const omitted = content.length - maxChars;
	const header = `[Digest truncated: omitted ${omitted} chars.]`;
	const remaining = maxChars - header.length - 2;
	if (remaining <= 0) return header;
	return `${header}\n\n${content.slice(0, remaining)}`;
}

function pushMessage(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	message: {
		customType: string;
		content: string;
		display: true;
	},
): void {
	if (ctx.isIdle()) {
		pi.sendMessage(message, { triggerTurn: false });
		return;
	}

	pi.sendMessage(message, { deliverAs: "followUp", triggerTurn: false });
}

async function persistLessonsForTargets(
	targets: string[],
	lessons: string[],
): Promise<number> {
	let addedCount = 0;

	for (const target of targets) {
		let existingContent = "";
		if (existsSync(target)) {
			existingContent = readFileSync(target, "utf-8");
		}

		const merged = mergeLessonsIntoAgentsContent(existingContent, lessons);
		if (merged.addedCount === 0) continue;
		addedCount += merged.addedCount;

		await mkdir(dirname(target), { recursive: true });
		const contentToWrite = merged.content.endsWith("\n")
			? merged.content
			: `${merged.content}\n`;
		await writeFile(target, contentToWrite, "utf-8");
	}

	return addedCount;
}

export function applyLearnStuffTwo(systemPrompt: string): string {
	if (systemPrompt.includes(LEARN_STUFF_2_MODE_SENTINEL)) {
		return systemPrompt; // [ref:learn_stuff_2_lessons_block_format]
	}

	const basePrompt = systemPrompt.trimEnd();
	if (basePrompt.length === 0) {
		return LEARN_STUFF_2_ADDITIONAL_CONTEXT;
	}

	return `${basePrompt}\n\n${LEARN_STUFF_2_ADDITIONAL_CONTEXT}`;
}

export default function learnStuffTwo(pi: ExtensionAPI) {
	const pendingModifiedPaths = new Set<string>();
	let persistenceQueue: Promise<void> = Promise.resolve();

	function queuePersistence(targets: string[], lessons: string[]): void {
		persistenceQueue = persistenceQueue
			.then(() => persistLessonsForTargets(targets, lessons))
			.catch((error) => {
				console.error("learn-stuff-2: failed to persist lessons", error);
			});
	}

	pi.on("before_agent_start", async (event) => {
		pendingModifiedPaths.clear();
		return {
			systemPrompt: applyLearnStuffTwo(event.systemPrompt),
		};
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") {
			return;
		}

		const input = event.input as Record<string, unknown>;
		const maybePath =
			typeof input.path === "string"
				? input.path
				: typeof input.filePath === "string"
					? input.filePath
					: undefined;

		if (!maybePath) return;
		const absolutePath = normalizeToolPath(maybePath, ctx.cwd);
		if (!absolutePath) return;
		pendingModifiedPaths.add(absolutePath);
	});

	pi.on("agent_end", async (event, ctx) => {
		const modifiedPaths = [...pendingModifiedPaths];
		pendingModifiedPaths.clear();
		if (modifiedPaths.length === 0) return;

		const output = extractLatestAssistantOutput(
			event.messages as AgentEndMessageLike[] | undefined,
		);
		if (!output) return;

		const lessons = extractLessonsFromAssistantOutput(output);
		if (lessons.length === 0) return;

		const projectRoot = findProjectRoot(ctx.cwd);
		const targets = new Set<string>();

		for (const modifiedPath of modifiedPaths) {
			if (!isPathInsideRoot(modifiedPath, projectRoot)) continue;
			const target = resolveNearestAgentsPathForModifiedFile(
				modifiedPath,
				projectRoot,
			);
			targets.add(target);
		}

		if (targets.size === 0) return;
		queuePersistence([...targets], lessons);
	});

	pi.registerCommand(SHOW_LESSONS_COMMAND, {
		description: "Collect Lessons sections from AGENTS.md files",
		handler: async (_args, ctx) => {
			const projectRoot = findProjectRoot(ctx.cwd);
			const agentsFiles = collectAgentsFiles(projectRoot);

			if (agentsFiles.length === 0) {
				pushMessage(pi, ctx, {
					customType: SHOW_LESSONS_MESSAGE_TYPE,
					content: `No AGENTS.md files found under ${projectRoot}.`,
					display: true,
				});
				return;
			}

			const lessonsByFile: LessonsByFile[] = [];
			for (const agentsPath of agentsFiles) {
				let content = "";
				try {
					content = readFileSync(agentsPath, "utf-8");
				} catch {
					continue;
				}

				const sections = extractLessonsSectionsFromAgentsContent(content);
				if (sections.length === 0) continue;
				lessonsByFile.push({ path: agentsPath, sections });
			}

			if (lessonsByFile.length === 0) {
				pushMessage(pi, ctx, {
					customType: SHOW_LESSONS_MESSAGE_TYPE,
					content:
						`Found ${agentsFiles.length} AGENTS.md file(s) under ${projectRoot}, ` +
						"but none contained a Lessons section.",
					display: true,
				});
				return;
			}

			const digest = buildLessonsDigest(projectRoot, lessonsByFile);
			pushMessage(pi, ctx, {
				customType: SHOW_LESSONS_MESSAGE_TYPE,
				content: capDigest(digest, SHOW_LESSONS_MAX_CHARS),
				display: true,
			});
		},
	});

	pi.registerCommand(ADD_LESSON_COMMAND, {
		description: "Manually add one lesson to cwd AGENTS.md",
		handler: async (args, ctx) => {
			const lesson = normalizeLesson(args);
			if (!lesson) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Usage: /${ADD_LESSON_COMMAND} <lesson>`, "warning");
				}
				return;
			}

			const target = join(ctx.cwd, "AGENTS.md");
			const added = await persistLessonsForTargets([target], [lesson]);

			if (!ctx.hasUI) return;
			if (added > 0) {
				ctx.ui.notify(`Added lesson to ${target}`, "success");
				return;
			}

			ctx.ui.notify(`Lesson already exists in ${target}`, "info");
		},
	});
}
