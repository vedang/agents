/**
 * Simplify-Code Extension
 *
 * Loads the simplify-code prompt and triggers it after significant
 * non-markdown code changes.
 */

import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
} from "@mariozechner/pi-coding-agent";

const SIMPLIFY_CODE_COMMAND = "/simplify-code";
export const DEFAULT_TRIGGER_REASON = "agent_end";
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);
const baseDir = dirname(fileURLToPath(import.meta.url));

const PROMPT_PATH = join(baseDir, "prompt.md");

function trimQuotes(value: string): string {
	return value.trim().replace(/^['"]|['"]$/g, "");
}

function normalizePath(path: string): string {
	return trimQuotes(path.trim());
}

function isMarkdownPath(path: string): boolean {
	const normalized = normalizePath(path);
	if (!normalized) return false;
	return MARKDOWN_EXTENSIONS.has(extname(normalized).toLowerCase());
}

export function shouldAutoTriggerSimplify(paths: Iterable<string>): boolean {
	let hasAny = false;
	let hasNonMarkdown = false;

	for (const rawPath of paths) {
		const normalized = normalizePath(rawPath);
		if (!normalized) continue;
		hasAny = true;
		if (!isMarkdownPath(normalized)) {
			hasNonMarkdown = true;
			break;
		}
	}

	return hasAny && hasNonMarkdown; // [tag:simplify_code_skip_markdown_only]
}

export function extractPathsFromPatch(patchText: string): string[] {
	const paths: string[] = [];
	const lines = patchText.split(/\r?\n/);

	for (const line of lines) {
		const match = line.match(
			/^\*{3}\s(?:Add File|Update File|Delete File):\s(.+)$/,
		);
		if (match) {
			paths.push(trimQuotes(match[1]));
			continue;
		}
		const moveMatch = line.match(/^\*{3}\sMove to:\s(.+)$/);
		if (moveMatch) {
			paths.push(trimQuotes(moveMatch[1]));
		}
	}

	return paths;
}

function loadPromptBody(): string | null {
	const raw = readFileSync(PROMPT_PATH, "utf-8");
	const frontmatter = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	const body = frontmatter ? raw.slice(frontmatter[0].length) : raw;
	const normalized = body.trim();
	return normalized.length > 0 ? normalized : null;
}

function isSimplifyCommand(text: string | undefined): boolean {
	return text?.trim().toLowerCase().startsWith(SIMPLIFY_CODE_COMMAND) ?? false;
}

function recordPathsFromToolCall(
	event: ToolCallEvent,
	paths: Set<string>,
): void {
	if (event.toolName === "write" || event.toolName === "edit") {
		const input = event.input as { path?: string };
		if (typeof input.path === "string") {
			paths.add(input.path);
		}
		return;
	}

	if (event.toolName === "apply_patch") {
		const input = event.input as { patchText?: string };
		if (typeof input.patchText === "string") {
			for (const path of extractPathsFromPatch(input.patchText)) {
				paths.add(path);
			}
		}
	}
}

export default function simplifyCodeExtension(pi: ExtensionAPI): void {
	let lastInputText: string | undefined;
	let lastInputSource: "interactive" | "rpc" | "extension" | undefined;
	let warnedMissingPrompt = false;
	let warnedMissingCommand = false;
	const pendingPaths = new Set<string>();

	function hasSimplifyCommand(): boolean {
		return pi.getCommands().some((command) => command.name === "simplify-code");
	}

	function triggerSimplify(reason: string, ctx: ExtensionContext): boolean {
		if (!hasSimplifyCommand()) {
			if (!warnedMissingCommand && ctx.hasUI) {
				warnedMissingCommand = true;
				ctx.ui.notify(
					"simplify-code hook: /simplify-code command not available",
					"warning",
				);
			}
			return false;
		}

		warnedMissingCommand = false;
		const command = `${SIMPLIFY_CODE_COMMAND} ${reason}`.trim();

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
				ctx.ui.notify(`simplify-code hook failed: ${message}`, "warning");
			}
			return false;
		}
	}

	pi.registerCommand("simplify-code", {
		description: "Review and simplify recently changed code",
		handler: async (args, ctx) => {
			const promptBody = loadPromptBody();
			if (!promptBody) {
				if (ctx.hasUI && !warnedMissingPrompt) {
					warnedMissingPrompt = true;
					ctx.ui.notify("simplify-code prompt file missing", "warning");
				}
				return;
			}

			warnedMissingPrompt = false;
			pendingPaths.clear();
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

	pi.on("input", async (event) => {
		lastInputText = event.text;
		lastInputSource = event.source;
	});

	pi.on("tool_call", async (event) => {
		recordPathsFromToolCall(event, pendingPaths);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (ctx.hasPendingMessages()) return;
		if (lastInputSource === "extension" && isSimplifyCommand(lastInputText)) {
			pendingPaths.clear();
			return;
		}
		if (!shouldAutoTriggerSimplify(pendingPaths)) {
			pendingPaths.clear();
			return;
		}

		pendingPaths.clear();
		triggerSimplify(DEFAULT_TRIGGER_REASON, ctx);
	});
}
