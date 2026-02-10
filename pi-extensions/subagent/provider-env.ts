export interface SubagentProviderKnobs {
	temperature?: number;
	topP?: number;
	clearThinking?: boolean;
	zaiBaseUrl?: string;
}

function parseOptionalNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		const parsed = Number.parseFloat(trimmed);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
		if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
	}
	return undefined;
}

function parseOptionalString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function parseSubagentProviderFrontmatter(
	frontmatter: Record<string, unknown>,
): SubagentProviderKnobs {
	return {
		temperature: parseOptionalNumber(frontmatter.temperature),
		topP: parseOptionalNumber(frontmatter.top_p),
		clearThinking: parseOptionalBoolean(frontmatter.clear_thinking),
		zaiBaseUrl: parseOptionalString(frontmatter.zai_base_url),
	};
}

/**
 * [ref:zai_custom_env_knob_contract]
 */
export function buildSubagentProviderEnv(
	knobs: SubagentProviderKnobs,
	baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...baseEnv };

	if (knobs.temperature !== undefined) {
		const value = `${knobs.temperature}`;
		env.PI_ZAI_TEMPERATURE = value;
		env.ZAI_TEMPERATURE = value;
	}
	if (knobs.topP !== undefined) {
		const value = `${knobs.topP}`;
		env.PI_ZAI_TOP_P = value;
		env.ZAI_TOP_P = value;
	}
	if (knobs.clearThinking !== undefined) {
		const value = knobs.clearThinking ? "true" : "false";
		env.PI_ZAI_CLEAR_THINKING = value;
		env.ZAI_CLEAR_THINKING = value;
	}
	if (knobs.zaiBaseUrl !== undefined) {
		env.PI_ZAI_BASE_URL = knobs.zaiBaseUrl;
		env.ZAI_BASE_URL = knobs.zaiBaseUrl;
	}

	return env;
}
