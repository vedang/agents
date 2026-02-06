/**
 * Learn-Stuff Extension
 *
 * Loads the /learn-stuff prompt text from this extension folder and triggers
 * learn-stuff on key workflow events.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const LEARN_STUFF_COMMAND = "/learn-stuff";
const LEARN_STUFF_EVENT = "learn-stuff:trigger";
const baseDir = dirname(fileURLToPath(import.meta.url));
const PROMPT_FILE = join(baseDir, "prompt.md");

type LearnStuffTriggerPayload = {
	reason?: string;
};

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

export default function learnStuffExtension(pi: ExtensionAPI): void {
	let lastInputText: string | undefined;
	let lastInputSource: "interactive" | "rpc" | "extension" | undefined;
	let currentCtx: ExtensionContext | undefined;
	let warnedMissingPrompt = false;

	pi.registerCommand("learn-stuff", {
		description: "Capture lessons into the closest relevant AGENTS.md file(s)",
		handler: async (args, ctx) => {
			const promptBody = loadPromptBody();
			if (!promptBody) {
				if (ctx.hasUI) {
					ctx.ui.notify(`learn-stuff prompt file missing: ${PROMPT_FILE}`, "warning");
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

	function rememberContext(ctx: ExtensionContext): void {
		currentCtx = ctx;
	}

	function hasLearnStuffPrompt(): boolean {
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
			if (entry.type !== "custom" || entry.customType !== "loop-state") continue;
			return Boolean(entry.data?.active);
		}
		return false;
	}

	function triggerLearnStuff(reason: string, ctx: ExtensionContext): void {
		if (!hasLearnStuffPrompt()) {
			if (!warnedMissingPrompt && ctx.hasUI) {
				warnedMissingPrompt = true;
				ctx.ui.notify("learn-stuff hook: /learn-stuff command not available", "warning");
			}
			return;
		}

		warnedMissingPrompt = false;
		const command = `${LEARN_STUFF_COMMAND} ${reason}`.trim();

		try {
			if (ctx.isIdle()) {
				pi.sendUserMessage(command);
			} else {
				pi.sendUserMessage(command, { deliverAs: "followUp" });
			}
		} catch (error) {
			if (!ctx.hasUI) return;
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`learn-stuff hook failed: ${message}`, "warning");
		}
	}

	pi.events.on(LEARN_STUFF_EVENT, (payload) => {
		if (!currentCtx) return;
		if (isLearnStuffInput(lastInputText)) return;
		triggerLearnStuff(getReason(payload), currentCtx);
	});

	pi.on("session_start", async (_event, ctx) => {
		rememberContext(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		rememberContext(ctx);
	});

	pi.on("input", async (event, ctx) => {
		lastInputText = event.text;
		lastInputSource = event.source;
		rememberContext(ctx);
	});

	pi.on("session_fork", async (_event, ctx) => {
		rememberContext(ctx);
		triggerLearnStuff("fork", ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		rememberContext(ctx);
		if (ctx.hasPendingMessages()) return;
		if (lastInputSource === "extension") return;
		if (isLearnStuffInput(lastInputText)) return;
		if (isLoopActive(ctx)) return;
		triggerLearnStuff("session_end", ctx);
	});
}
