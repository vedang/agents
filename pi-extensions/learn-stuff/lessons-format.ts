const INSIGHT_HEADER = "★ Insight ─────────────────────────────────────";
const INSIGHT_FOOTER = "─────────────────────────────────────────────────";

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function stripMarkdown(text: string): string {
	return normalizeWhitespace(
		text
			.replace(/```[\s\S]*?```/g, " ")
			.replace(/`([^`]+)`/g, "$1")
			.replace(/^\s{0,3}(?:[-*+]\s+|\d+\.\s+)/gm, "")
			.replace(/^#{1,6}\s+/gm, "")
			.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"),
	);
}

function extractHeadingSection(content: string, heading: string): string {
	const lines = content.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
		if (!match) continue;
		const level = match[1].length;
		if (match[2].trim().toLowerCase() !== heading.toLowerCase()) continue;

		const sectionStart = i + 1;
		let sectionEnd = lines.length;
		for (let j = sectionStart; j < lines.length; j++) {
			const headingMatch = lines[j].match(/^(#{1,6})\s+(.+?)\s*$/);
			if (!headingMatch) continue;
			if (headingMatch[1].length <= level) {
				sectionEnd = j;
				break;
			}
		}
		return lines.slice(sectionStart, sectionEnd).join("\n").trim();
	}
	return "";
}

export function limitToSentences(text: string, maxSentences: number): string {
	const normalized = normalizeWhitespace(text);
	if (!normalized || maxSentences <= 0) return "";

	const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
	if (sentences.length <= maxSentences) return normalized;
	return normalizeWhitespace(sentences.slice(0, maxSentences).join(" "));
}

export function extractLessonsSummary(output: string): string {
	const explicit = extractHeadingSection(output, "Lessons");
	if (explicit) {
		return limitToSentences(stripMarkdown(explicit), 2);
	}

	const stripped = stripMarkdown(output);
	if (!stripped) {
		return "Capture concise, durable lessons for future turns.";
	}

	return limitToSentences(stripped, 2);
}

export function formatInsightLessonsBlock(lessonText: string): string {
	const limited = limitToSentences(stripMarkdown(lessonText), 2);
	const body = limited || "Capture concise, durable lessons for future turns.";
	return `${INSIGHT_HEADER}\n${body}\n${INSIGHT_FOOTER}`;
}
