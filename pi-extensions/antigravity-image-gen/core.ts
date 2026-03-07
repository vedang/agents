import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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

export type ImagePayload = {
	mimeType: string;
	data: string;
};

export type ExtractedImageDataUri = {
	mimeType: string;
	data: string;
	encoding: "base64" | "uri";
};

export type ToolImagePreviewMode = "native" | "rasterized-svg" | "raw-svg";

export const SAVE_MODES = ["none", "project", "global", "custom"] as const;
export type SaveMode = (typeof SAVE_MODES)[number];
export const DEFAULT_SAVE_MODE: SaveMode = "project";

export type SaveConfigParams = {
	save?: SaveMode;
	saveDir?: string;
};

export type SaveConfigOverrides = {
	config?: {
		save?: SaveMode;
		saveDir?: string;
	};
	envMode?: string;
	envSaveDir?: string;
	homeDir?: string;
};

export type SaveConfig = {
	mode: SaveMode;
	outputDir?: string;
};

export type PreparedToolResultImage = {
	savedImage: ImagePayload;
	attachmentImage: ImagePayload;
	previewMode: ToolImagePreviewMode;
};

export type GeneratedImageSummaryParams = {
	providerLabel: string;
	model: string;
	aspectRatio: string;
	source: "inline-data" | "data-uri";
	savedPaths?: string[];
	saveError?: string;
	textParts: string[];
	previewMode?: ToolImagePreviewMode;
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

// [tag:antigravity_svg_fallback_requires_raster_preview] The Antigravity fallback prompt
// prefers SVG because a text-first model can reliably emit a self-contained vector image with
// readable lettering. Pi's inline terminal previews, however, are much more reliable with raster
// attachments. Keep the original SVG as the source artifact, but rasterize it to PNG for the tool
// attachment preview when local tooling is available.
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
		// [ref:antigravity_svg_fallback_requires_raster_preview]
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

function isSvgMimeType(mimeType: string): boolean {
	return mimeType.toLowerCase().includes("svg");
}

function stripDataImageMarkdown(text: string): string {
	return text
		.replace(/!\[[^\]]*\]\(\s*data:image\/[^)]+\)/gi, " ")
		.replace(/data:image\/[^,\s)]+(?:;base64)?,[^\s)"']+/gi, " ")
		.replace(/\(\s*\)/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function sanitizeModelNotes(textParts: string[]): string[] {
	return textParts.map(stripDataImageMarkdown).filter(Boolean);
}

export async function prepareToolResultImage(
	image: ImagePayload,
	rasterizeSvgToPng?: (
		image: ImagePayload,
	) => Promise<ImagePayload | undefined>,
): Promise<PreparedToolResultImage> {
	if (!isSvgMimeType(image.mimeType)) {
		return {
			savedImage: image,
			attachmentImage: image,
			previewMode: "native",
		};
	}

	if (rasterizeSvgToPng) {
		const rasterized = await rasterizeSvgToPng(image);
		if (rasterized) {
			return {
				savedImage: image,
				attachmentImage: rasterized,
				previewMode: "rasterized-svg",
			};
		}
	}

	return {
		savedImage: image,
		attachmentImage: image,
		previewMode: "raw-svg",
	};
}

export function resolveSaveConfig(
	params: SaveConfigParams,
	cwd: string,
	overrides: SaveConfigOverrides = {},
): SaveConfig {
	const envMode = (overrides.envMode || "").toLowerCase();
	const mode = (params.save ||
		envMode ||
		overrides.config?.save ||
		DEFAULT_SAVE_MODE) as SaveMode;

	if (!SAVE_MODES.includes(mode)) {
		return {
			mode: DEFAULT_SAVE_MODE,
			outputDir: DEFAULT_SAVE_MODE === "project" ? cwd : undefined,
		};
	}

	if (mode === "project") {
		return { mode, outputDir: cwd };
	}

	if (mode === "global") {
		return {
			mode,
			outputDir: join(
				overrides.homeDir || homedir(),
				".pi",
				"agent",
				"generated-images",
			),
		};
	}

	if (mode === "custom") {
		const dir =
			params.saveDir || overrides.envSaveDir || overrides.config?.saveDir;
		if (!dir || !dir.trim()) {
			throw new Error("save=custom requires saveDir or PI_IMAGE_SAVE_DIR.");
		}
		return { mode, outputDir: dir };
	}

	return { mode };
}

type SaveArtifact = {
	role: "source" | "preview";
	image: ImagePayload;
};

// [ref:antigravity_svg_fallback_requires_raster_preview] When SVG fallback output is
// rasterized for terminal preview, persist both the original source SVG and the preview PNG
// so callers keep an editable source artifact alongside a widely compatible bitmap copy.
function buildSaveArtifacts(
	preparedImage: PreparedToolResultImage,
): SaveArtifact[] {
	const artifacts: SaveArtifact[] = [
		{ role: "source", image: preparedImage.savedImage },
	];
	if (
		preparedImage.savedImage.mimeType !==
			preparedImage.attachmentImage.mimeType ||
		preparedImage.savedImage.data !== preparedImage.attachmentImage.data
	) {
		artifacts.push({ role: "preview", image: preparedImage.attachmentImage });
	}
	return artifacts;
}

function buildGeneratedImageBaseName(): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `image-${timestamp}-${randomUUID().slice(0, 8)}`;
}

export async function saveGeneratedArtifacts(
	preparedImage: PreparedToolResultImage,
	outputDir: string,
	baseName = buildGeneratedImageBaseName(),
): Promise<string[]> {
	await mkdir(outputDir, { recursive: true });
	const artifacts = buildSaveArtifacts(preparedImage);
	const extensionCounts = new Map<string, number>();

	for (const artifact of artifacts) {
		const ext = imageExtension(artifact.image.mimeType);
		extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
	}

	const savedPaths: string[] = [];
	for (const artifact of artifacts) {
		const ext = imageExtension(artifact.image.mimeType);
		const needsRoleSuffix = (extensionCounts.get(ext) || 0) > 1;
		const filename = needsRoleSuffix
			? `${baseName}-${artifact.role}.${ext}`
			: `${baseName}.${ext}`;
		const filePath = join(outputDir, filename);
		await writeFile(filePath, Buffer.from(artifact.image.data, "base64"));
		savedPaths.push(filePath);
	}

	return savedPaths;
}

export function buildGeneratedImageSummary(
	params: GeneratedImageSummaryParams,
): string {
	const summaryParts = [
		`Generated image via ${params.providerLabel}/${params.model}.`,
		`Aspect ratio: ${params.aspectRatio}.`,
	];
	if (params.source === "data-uri") {
		summaryParts.push("Decoded image from Antigravity text output fallback.");
	}
	if (params.previewMode === "rasterized-svg") {
		summaryParts.push("Rasterized SVG fallback to PNG for terminal preview.");
	} else if (params.previewMode === "raw-svg") {
		summaryParts.push(
			"Returned SVG fallback directly; some terminals may not display SVG previews.",
		);
	}
	if (params.savedPaths && params.savedPaths.length > 0) {
		const prefix =
			params.savedPaths.length === 1 ? "Saved image to:" : "Saved images to:";
		summaryParts.push(`${prefix} ${params.savedPaths.join(", ")}`);
	} else if (params.saveError) {
		summaryParts.push(`Failed to save image: ${params.saveError}`);
	}
	const modelNotes = sanitizeModelNotes(params.textParts);
	if (modelNotes.length > 0) {
		summaryParts.push(`Model notes: ${modelNotes.join(" ")}`);
	}
	return summaryParts.join(" ");
}

export function imageExtension(mimeType: string): string {
	const lower = mimeType.toLowerCase();
	if (lower.includes("svg")) return "svg";
	if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
	if (lower.includes("gif")) return "gif";
	if (lower.includes("webp")) return "webp";
	return "png";
}
