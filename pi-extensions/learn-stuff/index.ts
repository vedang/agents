/**
 * Learn-Stuff Extension
 *
 * Provides the /learn-stuff prompt template from this extension folder and
 * triggers it on key workflow events.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const LEARN_STUFF_COMMAND = "/learn-stuff";
const LEARN_STUFF_EVENT = "learn-stuff:trigger";
const baseDir = dirname(fileURLToPath(import.meta.url));

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

export default function learnStuffExtension(pi: ExtensionAPI): void {
	let lastInputText: string | undefined;
	let lastInputSource: "interactive" | "rpc" | "extension" | undefined;
	let currentCtx: ExtensionContext | undefined;
	let warnedMissingPrompt = false;

	pi.on("resources_discover", () => {
		return {
			promptPaths: [join(baseDir, "prompt.md")],
		};
	});

	function rememberContext(ctx: ExtensionContext): void {
		currentCtx = ctx;
	}

	function hasLearnStuffPrompt(): boolean {
		return pi
			.getCommands()
			.some((command) => command.name === "learn-stuff" && command.source === "prompt");
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
				ctx.ui.notify("learn-stuff hook: /learn-stuff prompt not found", "warning");
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
