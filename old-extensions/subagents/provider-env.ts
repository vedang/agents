export interface SubagentProviderKnobs {
	temperature?: number;
	topP?: number;
	clearThinking?: boolean;
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

function setEnvValue(
	env: NodeJS.ProcessEnv,
	key: string,
	value: string | undefined,
): void {
	if (value === undefined) return;
	env[key] = value;
}

function numberToEnvValue(value: number | undefined): string | undefined {
	if (value === undefined) return undefined;
	return `${value}`;
}

function booleanToEnvValue(value: boolean | undefined): string | undefined {
	if (value === undefined) return undefined;
	return value ? "true" : "false";
}

export function parseSubagentProviderFrontmatter(
	frontmatter: Record<string, unknown>,
): SubagentProviderKnobs {
	return {
		temperature: parseOptionalNumber(frontmatter.temperature),
		topP: parseOptionalNumber(frontmatter.top_p),
		clearThinking: parseOptionalBoolean(frontmatter.clear_thinking),
	};
}

/**
 * [tag:generic_temperature_env_contract]
 * Generic temperature knob is emitted as PI_TEMPERATURE for consumption
 * by any provider that supports temperature sampling (not just ZAI).
 */
export function buildSubagentProviderEnv(
	knobs: SubagentProviderKnobs,
	baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...baseEnv };

	// [ref:generic_temperature_env_contract]
	setEnvValue(env, "PI_TEMPERATURE", numberToEnvValue(knobs.temperature));
	// [ref:zai_custom_env_knob_contract]
	setEnvValue(env, "PI_ZAI_CUSTOM_TOP_P", numberToEnvValue(knobs.topP));
	setEnvValue(
		env,
		"PI_ZAI_CUSTOM_CLEAR_THINKING",
		booleanToEnvValue(knobs.clearThinking),
	);

	return env;
}
