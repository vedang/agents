export interface RequestedModelConfig {
	provider?: string;
	model: string;
}

export type BuildModelCliArgsResult =
	| { ok: true; requested: RequestedModelConfig | null; args: string[] }
	| { ok: false; error: string };

export interface ModelRoutingSnapshot {
	requestedProvider?: string;
	requestedModel?: string;
	runtimeProvider?: string;
	runtimeModel?: string;
}

function formatModelLabel(provider: string | undefined, model: string | undefined): string | null {
	if (!model) return null;
	return provider ? `${provider}/${model}` : model;
}

function buildMissingModelError(providerRaw: string | undefined): string {
	const providerHint = providerRaw?.trim()
		? ` Provider is set to "${providerRaw.trim()}".`
		: "";
	return `Invalid model frontmatter: model is empty.${providerHint} Set model to a provider-local ID (for example model: zai-glm-4.7).`;
}

function buildNamespacedModelWithoutProviderError(rawModel: string): string {
	const trimmed = rawModel.trim();
	const slash = trimmed.indexOf("/");
	const suggestedProvider = slash > 0 ? trimmed.slice(0, slash) : "<provider>";
	const suggestedModel = slash > 0 ? trimmed.slice(slash + 1) : "<model>";
	return [
		`Invalid model frontmatter: model contains a provider prefix ("${trimmed}").`,
		"Do not encode provider in model.",
		`Use:\nprovider: ${suggestedProvider}\nmodel: ${suggestedModel}`,
	].join(" ");
}

function normalizeOptional(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function buildModelCliArgs(
	rawProvider: string | undefined,
	rawModel: string | undefined,
): BuildModelCliArgsResult {
	const provider = normalizeOptional(rawProvider);
	const model = normalizeOptional(rawModel);

	if (!model) {
		if (!provider) return { ok: true, requested: null, args: [] };
		return { ok: false, error: buildMissingModelError(rawProvider) };
	}

	if (!provider && model.includes("/")) {
		return { ok: false, error: buildNamespacedModelWithoutProviderError(model) };
	}

	if (provider) {
		return {
			ok: true,
			requested: { provider, model },
			args: ["--provider", provider, "--model", model],
		};
	}

	return {
		ok: true,
		requested: { model },
		args: ["--model", model],
	};
}

export function getRuntimeModelLabel(snapshot: ModelRoutingSnapshot): string | undefined {
	return formatModelLabel(snapshot.runtimeProvider, snapshot.runtimeModel) ?? undefined;
}

export function getModelMismatch(snapshot: ModelRoutingSnapshot): { requested: string; actual: string } | null {
	const requestedLabel = formatModelLabel(snapshot.requestedProvider, snapshot.requestedModel);
	const actualLabel = formatModelLabel(snapshot.runtimeProvider, snapshot.runtimeModel);
	if (!requestedLabel || !actualLabel) return null;

	if (snapshot.requestedProvider) {
		if (snapshot.requestedProvider === snapshot.runtimeProvider && snapshot.requestedModel === snapshot.runtimeModel) {
			return null;
		}
		return { requested: requestedLabel, actual: actualLabel };
	}

	if (snapshot.requestedModel === snapshot.runtimeModel) return null;
	return { requested: requestedLabel, actual: actualLabel };
}
