const MAX_REASON_LENGTH = 220;

const CORRECTION_PATTERNS: RegExp[] = [
	/\b(?:you\s+are|that's|that is|this is)\s+wrong\b/i,
	/\b(?:didn['’]t|doesn['’]t|do\s+not|don't)\s+work\b/i,
	/\b(?:please\s+)?(?:retry|re-run|rerun|fix|correct)\b/i,
	/\b(?:instead|rather\s+than)\b/i,
	/\bmissed\b/i,
	/\bregression\b/i,
	/\bbug\b/i,
];

export interface ToolResultEventLike {
	toolName?: string;
	isError?: boolean;
	content?: unknown;
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function truncateReason(text: string): string {
	if (text.length <= MAX_REASON_LENGTH) return text;
	return `${text.slice(0, MAX_REASON_LENGTH - 1)}…`;
}

function contentToText(content: unknown): string {
	if (typeof content === "string") return normalizeWhitespace(content);
	if (!Array.isArray(content)) return "";

	return normalizeWhitespace(
		content
			.filter((item): item is { type: string; text?: string } => Boolean(item && typeof item === "object"))
			.map((item) => (item.type === "text" && typeof item.text === "string" ? item.text : ""))
			.filter(Boolean)
			.join("\n"),
	);
}

export function isLikelyUserCorrection(text: string | undefined): boolean {
	if (!text) return false;
	const normalized = normalizeWhitespace(text);
	if (!normalized) return false;
	if (normalized.startsWith("/")) return false;
	return CORRECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildInterestingEventReasons(event: ToolResultEventLike): string[] {
	if (!event.isError || !event.toolName) return [];

	const summary = contentToText(event.content);
	const base = summary
		? `Tool ${event.toolName} failed: ${truncateReason(summary)}`
		: `Tool ${event.toolName} failed during execution.`;
	return [base];
}

export function mergeInterestingReasons(...groups: string[][]): string[] {
	const merged: string[] = [];
	const seen = new Set<string>();

	for (const group of groups) {
		for (const reason of group) {
			const normalized = normalizeWhitespace(reason);
			if (!normalized || seen.has(normalized)) continue;
			seen.add(normalized);
			merged.push(normalized);
		}
	}

	return merged;
}

export function reasonFromUserCorrection(text: string): string {
	return truncateReason(`User correction: ${normalizeWhitespace(text)}`);
}
