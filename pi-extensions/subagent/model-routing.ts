export interface RequestedModelConfig {
	raw: string;
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

function buildInvalidModelError(rawModel: string): string {
	return `Invalid model spec: "${rawModel}". Use "model" or "provider/model".`;
}

export function buildModelCliArgs(rawModel: string | undefined): BuildModelCliArgsResult {
	if (rawModel === undefined) {
		return { ok: true, requested: null, args: [] };
	}

	const raw = rawModel.trim();
	if (!raw) return { ok: false, error: buildInvalidModelError(rawModel) };

	const firstSlash = raw.indexOf("/");
	if (firstSlash === -1) {
		return {
			ok: true,
			requested: { raw, model: raw },
			args: ["--model", raw],
		};
	}

	const provider = raw.slice(0, firstSlash).trim();
	const model = raw.slice(firstSlash + 1).trim();
	if (!provider || !model) {
		return { ok: false, error: buildInvalidModelError(rawModel) };
	}

	return {
		ok: true,
		requested: { raw, provider, model },
		args: ["--provider", provider, "--model", model],
	};
}

export function getPreferredModelLabel(snapshot: ModelRoutingSnapshot): string | undefined {
	return (
		formatModelLabel(snapshot.runtimeProvider, snapshot.runtimeModel) ??
		formatModelLabel(snapshot.requestedProvider, snapshot.requestedModel) ??
		undefined
	);
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
