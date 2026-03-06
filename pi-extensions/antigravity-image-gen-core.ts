export const CURRENT_GOOGLE_IMAGE_MODELS = [
	"gemini-3.1-flash-image-preview",
	"gemini-3-pro-image-preview",
	"gemini-2.5-flash-image",
] as const;

export const DEFAULT_VERTEX_IMAGE_MODEL = CURRENT_GOOGLE_IMAGE_MODELS[0];
export const FALLBACK_ANTIGRAVITY_MODEL = "gemini-3.1-pro-high";
export const DEFAULT_IMAGE_SIZE = "1K" as const;

export type ModelAttempt = {
	transport: "vertex" | "antigravity";
	model: string;
};

export type VertexImageRequest = {
	contents: Array<{
		role: "user";
		parts: Array<{ text: string }>;
	}>;
	generationConfig: {
		responseModalities: ["IMAGE"];
		imageConfig: {
			aspectRatio: string;
			imageSize: typeof DEFAULT_IMAGE_SIZE;
		};
	};
};

export type ExtractedImageDataUri = {
	mimeType: string;
	data: string;
	encoding: "base64" | "uri";
};

export function isCurrentGoogleImageModel(model: string): boolean {
	return CURRENT_GOOGLE_IMAGE_MODELS.includes(
		model as (typeof CURRENT_GOOGLE_IMAGE_MODELS)[number],
	);
}

function buildSingleModelAttempt(model: string): ModelAttempt {
	if (isCurrentGoogleImageModel(model)) {
		return {
			transport: "vertex",
			model,
		};
	}

	return {
		transport: "antigravity",
		model,
	};
}

export function buildModelAttempts(requestedModel?: string): ModelAttempt[] {
	if (requestedModel?.trim()) {
		return [buildSingleModelAttempt(requestedModel)];
	}

	return [
		...CURRENT_GOOGLE_IMAGE_MODELS.map(
			(model): ModelAttempt => ({
				transport: "vertex",
				model,
			}),
		),
		{
			transport: "antigravity",
			model: FALLBACK_ANTIGRAVITY_MODEL,
		},
	];
}

export function buildVertexImageRequest(
	prompt: string,
	aspectRatio: string,
): VertexImageRequest {
	return {
		contents: [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		],
		generationConfig: {
			responseModalities: ["IMAGE"],
			imageConfig: {
				aspectRatio,
				imageSize: DEFAULT_IMAGE_SIZE,
			},
		},
	};
}

// [tag:antigravity_vertex_image_fallback] Antigravity's internal image route no longer
// accepts Google's current public image model IDs for this account/project, but the same
// OAuth token can still be used for Vertex AI when enabled. When Vertex is unavailable,
// we fall back to Antigravity's currently accessible general model and ask it to return a
// single data URI image so the extension remains usable instead of hard-failing on stale
// model names.
export function buildAntigravityFallbackPrompt(
	prompt: string,
	aspectRatio: string,
): string {
	return [
		prompt,
		`Target aspect ratio: ${aspectRatio}.`,
		"Respond with exactly one Markdown image whose URL is a data:image/ URI.",
		"Prefer SVG when possible so the image stays self-contained and text remains readable.",
		"Do not return JSON, code fences, or explanation.",
	].join("\n\n");
}

export function extractImageDataUri(
	text: string,
): ExtractedImageDataUri | undefined {
	const base64Match = text.match(/data:(image\/[^;\s)]+);base64,([^\s)"']+)/i);
	if (base64Match) {
		return {
			mimeType: base64Match[1],
			data: base64Match[2],
			encoding: "base64",
		};
	}

	const uriMatch = text.match(/data:(image\/[^,\s)]+),([^\s)"']+)/i);
	if (uriMatch) {
		return {
			mimeType: uriMatch[1],
			data: uriMatch[2],
			encoding: "uri",
		};
	}

	return undefined;
}

export function imageExtension(mimeType: string): string {
	const lower = mimeType.toLowerCase();
	if (lower.includes("svg")) return "svg";
	if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
	if (lower.includes("gif")) return "gif";
	if (lower.includes("webp")) return "webp";
	return "png";
}
