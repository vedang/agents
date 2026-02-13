/**
 * Simplify-Code Extension
 *
 * Tracks file changes and triggers the simplify-code prompt template
 * after non-markdown code changes.
 */

import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
} from "@mariozechner/pi-coding-agent";

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);
const baseDir = dirname(fileURLToPath(import.meta.url));

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

function isSimplifyCommand(text: string | undefined): boolean {
	return text?.trim().toLowerCase().startsWith("/simplify-code") ?? false;
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
	const pendingPaths = new Set<string>();

	function formatPathsMessage(paths: Set<string>): string {
		if (paths.size === 0) {
			return "/simplify-code";
		}

		const pathList = Array.from(paths)
			.map((p) => `  - ${p}`)
			.join("\n");

		return `/simplify-code The following code paths have changed:\n${pathList}`;
	}

	pi.on("input", async (event) => {
		lastInputText = event.text;
		lastInputSource = event.source;
	});

	pi.on("tool_call", async (event) => {
		recordPathsFromToolCall(event, pendingPaths);
	});

	pi.on("agent_end", async (_event, ctx) => {
		// Don't trigger if there are pending messages
		if (ctx.hasPendingMessages()) {
			pendingPaths.clear();
			return;
		}

		// Avoid triggering if this was triggered by the extension itself
		if (lastInputSource === "extension" && isSimplifyCommand(lastInputText)) {
			pendingPaths.clear();
			return;
		}

		// Only trigger if non-markdown files were changed
		if (!shouldAutoTriggerSimplify(pendingPaths)) {
			pendingPaths.clear();
			return;
		}

		// Send the follow-up message with changed paths
		const message = formatPathsMessage(pendingPaths);
		pendingPaths.clear();

		if (ctx.isIdle()) {
			pi.sendUserMessage(message);
		} else {
			pi.sendUserMessage(message, { deliverAs: "followUp" });
		}
	});
}