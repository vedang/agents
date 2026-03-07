/**
 * Antigravity Image Generation
 *
 * Generates images with Google's current image models when possible.
 *
 * Strategy:
 * 1. Try current Google image models through Vertex AI using the same
 *    google-antigravity OAuth token/project.
 * 2. If Vertex AI is unavailable for the project, fall back to the current
 *    Antigravity-accessible model and reconstruct a self-contained image from
 *    a returned data URI.
 *
 * Returns images as tool result attachments for inline terminal rendering.
 * Requires OAuth login via /login for google-antigravity.
 *
 * Save modes (tool param, env var, or config file):
 *   save=project  - Save to the current working directory (default)
 *   save=none     - Don't save to disk
 *   save=global   - Save to ~/.pi/agent/generated-images/
 *   save=custom   - Save to saveDir param or PI_IMAGE_SAVE_DIR
 *
 * Environment variables:
 *   PI_IMAGE_SAVE_MODE  - Default save mode (project|none|global|custom)
 *   PI_IMAGE_SAVE_DIR   - Directory for custom save mode
 *
 * Config files (project overrides global):
 *   ~/.pi/agent/extensions/antigravity-image-gen.json
 *   <repo>/.pi/extensions/antigravity-image-gen.json
 *   Example: { "save": "global" }
 */

import { execFile as execFileCallback } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";

import {
	buildAntigravityFallbackPrompt,
	buildGeneratedImageSummary,
	buildModelAttempts,
	buildVertexImageRequest,
	extractImageDataUri,
	prepareToolResultImage,
	resolveSaveConfig,
	SAVE_MODES,
	saveGeneratedArtifacts,
	type ImagePayload,
	type SaveMode,
} from "./core";

const PROVIDER = "google-antigravity";
const VERTEX_PROVIDER = "google-vertex";

const ASPECT_RATIOS = [
	"1:1",
	"2:3",
	"3:2",
	"3:4",
	"4:3",
	"4:5",
	"5:4",
	"9:16",
	"16:9",
	"21:9",
] as const;

type AspectRatio = (typeof ASPECT_RATIOS)[number];

const DEFAULT_ASPECT_RATIO: AspectRatio = "1:1";

const ANTIGRAVITY_ENDPOINT =
	"https://daily-cloudcode-pa.sandbox.googleapis.com";
const VERTEX_ENDPOINT = "https://aiplatform.googleapis.com";
const VERTEX_LOCATION = "global";
const DEFAULT_ANTIGRAVITY_VERSION = "1.18.3";

const ANTIGRAVITY_HEADERS = {
	"User-Agent": `antigravity/${process.env.PI_AI_ANTIGRAVITY_VERSION || DEFAULT_ANTIGRAVITY_VERSION} darwin/arm64`,
	"X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
	"Client-Metadata": JSON.stringify({
		ideType: "IDE_UNSPECIFIED",
		platform: "PLATFORM_UNSPECIFIED",
		pluginType: "GEMINI",
	}),
};

const execFile = promisify(execFileCallback);

const TOOL_PARAMS = Type.Object({
	prompt: Type.String({ description: "Image description." }),
	model: Type.Optional(
		Type.String({
			description:
				"Optional model override. Current Google image models are tried via Vertex AI first; unsupported values fall back to Antigravity behavior.",
		}),
	),
	aspectRatio: Type.Optional(StringEnum(ASPECT_RATIOS)),
	save: Type.Optional(StringEnum(SAVE_MODES)),
	saveDir: Type.Optional(
		Type.String({
			description:
				"Directory to save image when save=custom. Defaults to PI_IMAGE_SAVE_DIR if set.",
		}),
	),
});

type ToolParams = Static<typeof TOOL_PARAMS>;

interface CloudCodeAssistRequest {
	project: string;
	model: string;
	request: {
		contents: Array<{
			role: "user";
			parts: Array<{ text: string }>;
		}>;
		generationConfig?: {
			candidateCount?: number;
		};
		safetySettings?: Array<{ category: string; threshold: string }>;
	};
	requestType?: string;
	userAgent?: string;
	requestId?: string;
}

interface CloudCodeAssistResponseChunk {
	response?: {
		candidates?: Array<{
			content?: {
				parts?: ResponsePart[];
			};
		}>;
	};
}

interface ResponsePart {
	text?: string;
	inlineData?: {
		mimeType?: string;
		data?: string;
	};
	inline_data?: {
		mime_type?: string;
		data?: string;
	};
}

interface ParsedCredentials {
	accessToken: string;
	projectId: string;
}

interface ExtensionConfig {
	save?: SaveMode;
	saveDir?: string;
}

interface ParsedImageResult {
	image: ImagePayload;
	text: string[];
	source: "inline-data" | "data-uri";
}

function parseOAuthCredentials(raw: string): ParsedCredentials {
	let parsed: { token?: string; projectId?: string };
	try {
		parsed = JSON.parse(raw) as { token?: string; projectId?: string };
	} catch {
		throw new Error(
			"Invalid Google OAuth credentials. Run /login to re-authenticate.",
		);
	}
	if (!parsed.token || !parsed.projectId) {
		throw new Error(
			"Missing token or projectId in Google OAuth credentials. Run /login.",
		);
	}
	return { accessToken: parsed.token, projectId: parsed.projectId };
}

function readConfigFile(path: string): ExtensionConfig {
	if (!existsSync(path)) {
		return {};
	}
	try {
		const content = readFileSync(path, "utf-8");
		const parsed = JSON.parse(content) as ExtensionConfig;
		return parsed ?? {};
	} catch {
		return {};
	}
}

function loadConfig(cwd: string): ExtensionConfig {
	const globalConfig = readConfigFile(
		join(homedir(), ".pi", "agent", "extensions", "antigravity-image-gen.json"),
	);
	const projectConfig = readConfigFile(
		join(cwd, ".pi", "extensions", "antigravity-image-gen.json"),
	);
	return { ...globalConfig, ...projectConfig };
}

interface SvgRasterizer {
	command: string;
	buildArgs: (
		inputPath: string,
		outputPath: string,
		workDir: string,
	) => string[];
	resolveOutputPath?: (
		inputPath: string,
		outputPath: string,
		workDir: string,
	) => string;
}

const SVG_RASTERIZERS: SvgRasterizer[] = [
	{
		command: "rsvg-convert",
		buildArgs: (inputPath, outputPath) => [inputPath, "-o", outputPath],
	},
	{
		command: "magick",
		buildArgs: (inputPath, outputPath) => [inputPath, outputPath],
	},
	{
		command: "convert",
		buildArgs: (inputPath, outputPath) => [inputPath, outputPath],
	},
	{
		command: "inkscape",
		buildArgs: (inputPath, outputPath) => [
			inputPath,
			"--export-type=png",
			`--export-filename=${outputPath}`,
		],
	},
	{
		command: "qlmanage",
		buildArgs: (inputPath, _outputPath, workDir) => [
			"-t",
			"-s",
			"1024",
			"-o",
			workDir,
			inputPath,
		],
		resolveOutputPath: (inputPath, _outputPath, workDir) =>
			join(workDir, `${basename(inputPath)}.png`),
	},
];

async function rasterizeSvgToPng(
	image: ImagePayload,
): Promise<ImagePayload | undefined> {
	const workDir = await mkdtemp(join(tmpdir(), "pi-antigravity-image-"));
	const inputPath = join(workDir, "image.svg");
	const outputPath = join(workDir, "image.png");

	try {
		await writeFile(inputPath, Buffer.from(image.data, "base64"));

		for (const rasterizer of SVG_RASTERIZERS) {
			const resolvedOutputPath =
				rasterizer.resolveOutputPath?.(inputPath, outputPath, workDir) ||
				outputPath;
			try {
				await execFile(
					rasterizer.command,
					rasterizer.buildArgs(inputPath, outputPath, workDir),
					{
						timeout: 15_000,
						maxBuffer: 10 * 1024 * 1024,
					},
				);
				const pngBytes = await readFile(resolvedOutputPath);
				if (pngBytes.length > 0) {
					return {
						mimeType: "image/png",
						data: pngBytes.toString("base64"),
					};
				}
			} catch {}
		}

		return undefined;
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

function buildAntigravityRequest(
	prompt: string,
	model: string,
	projectId: string,
): CloudCodeAssistRequest {
	return {
		project: projectId,
		model,
		request: {
			contents: [
				{
					role: "user",
					parts: [{ text: prompt }],
				},
			],
			generationConfig: {
				candidateCount: 1,
			},
			safetySettings: [
				{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
				{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
				{
					category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
					threshold: "BLOCK_ONLY_HIGH",
				},
				{
					category: "HARM_CATEGORY_DANGEROUS_CONTENT",
					threshold: "BLOCK_ONLY_HIGH",
				},
				{
					category: "HARM_CATEGORY_CIVIC_INTEGRITY",
					threshold: "BLOCK_ONLY_HIGH",
				},
			],
		},
		requestType: "agent",
		requestId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
		userAgent: "antigravity",
	};
}

function buildVertexUrl(projectId: string, model: string): string {
	return `${VERTEX_ENDPOINT}/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:streamGenerateContent?alt=sse`;
}

function extractInlineImage(
	part: ResponsePart,
): { data: string; mimeType: string } | undefined {
	if (part.inlineData?.data) {
		return {
			data: part.inlineData.data,
			mimeType: part.inlineData.mimeType || "image/png",
		};
	}
	if (part.inline_data?.data) {
		return {
			data: part.inline_data.data,
			mimeType: part.inline_data.mime_type || "image/png",
		};
	}
	return undefined;
}

function dataUriToBase64(data: string, encoding: "base64" | "uri"): string {
	if (encoding === "base64") {
		return data;
	}
	return Buffer.from(decodeURIComponent(data), "utf-8").toString("base64");
}

async function parseSseForImage(
	response: Response,
	signal?: AbortSignal,
): Promise<ParsedImageResult> {
	if (!response.body) {
		throw new Error("No response body");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const textParts: string[] = [];

	try {
		while (true) {
			if (signal?.aborted) {
				throw new Error("Request was aborted");
			}

			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.startsWith("data:")) continue;
				const jsonStr = line.slice(5).trim();
				if (!jsonStr) continue;

				let chunk: CloudCodeAssistResponseChunk;
				try {
					chunk = JSON.parse(jsonStr) as CloudCodeAssistResponseChunk;
				} catch {
					continue;
				}

				const responseData = chunk.response;
				if (!responseData?.candidates) continue;

				for (const candidate of responseData.candidates) {
					const parts = candidate.content?.parts;
					if (!parts) continue;
					for (const part of parts) {
						if (part.text) {
							textParts.push(part.text);
						}
						const inlineImage = extractInlineImage(part);
						if (inlineImage) {
							await reader.cancel();
							return {
								image: inlineImage,
								text: textParts,
								source: "inline-data",
							};
						}
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	const extracted = extractImageDataUri(textParts.join(""));
	if (extracted) {
		return {
			image: {
				data: dataUriToBase64(extracted.data, extracted.encoding),
				mimeType: extracted.mimeType,
			},
			text: textParts,
			source: "data-uri",
		};
	}

	throw new Error("No image data returned by the model");
}

function isVertexUnavailableError(message: string): boolean {
	return (
		message.includes("Vertex AI API has not been used in project") ||
		message.includes("aiplatform.googleapis.com/overview") ||
		message.includes("PERMISSION_DENIED")
	);
}

async function getCredentials(ctx: {
	modelRegistry: {
		getApiKeyForProvider: (provider: string) => Promise<string | undefined>;
	};
}): Promise<ParsedCredentials> {
	const apiKey = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER);
	if (!apiKey) {
		throw new Error(
			"Missing Google Antigravity OAuth credentials. Run /login for google-antigravity.",
		);
	}
	return parseOAuthCredentials(apiKey);
}

export default function antigravityImageGen(pi: ExtensionAPI) {
	pi.registerTool({
		name: "generate_image",
		label: "Generate image",
		description:
			"Generate an image via Google's current image models using Antigravity OAuth. Saves files to the current working directory by default, and falls back to Antigravity-compatible output when needed. Optional override via save=project|global|custom|none.",
		parameters: TOOL_PARAMS,
		async execute(_toolCallId, params: ToolParams, signal, onUpdate, ctx) {
			const { accessToken, projectId } = await getCredentials(ctx);
			const aspectRatio = params.aspectRatio || DEFAULT_ASPECT_RATIO;
			const saveConfig = resolveSaveConfig(params, ctx.cwd, {
				config: loadConfig(ctx.cwd),
				envMode: process.env.PI_IMAGE_SAVE_MODE,
				envSaveDir: process.env.PI_IMAGE_SAVE_DIR,
				homeDir: homedir(),
			});
			const attempts = buildModelAttempts(params.model);
			const errors: string[] = [];
			let skipRemainingVertexAttempts = false;

			for (const [index, attempt] of attempts.entries()) {
				if (attempt.transport === "vertex" && skipRemainingVertexAttempts) {
					continue;
				}

				const providerLabel =
					attempt.transport === "vertex" ? VERTEX_PROVIDER : PROVIDER;
				onUpdate?.({
					content: [
						{
							type: "text",
							text: `Attempt ${index + 1}/${attempts.length}: requesting image from ${providerLabel}/${attempt.model}...`,
						},
					],
					details: {
						provider: providerLabel,
						model: attempt.model,
						aspectRatio,
						transport: attempt.transport,
					},
				});

				const url =
					attempt.transport === "vertex"
						? buildVertexUrl(projectId, attempt.model)
						: `${ANTIGRAVITY_ENDPOINT}/v1internal:streamGenerateContent?alt=sse`;
				const requestBody =
					attempt.transport === "vertex"
						? buildVertexImageRequest(params.prompt, aspectRatio)
						: buildAntigravityRequest(
								// [ref:antigravity_vertex_image_fallback]
								buildAntigravityFallbackPrompt(params.prompt, aspectRatio),
								attempt.model,
								projectId,
							);

				try {
					const response = await fetch(url, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"Content-Type": "application/json",
							Accept: "text/event-stream",
							...(attempt.transport === "antigravity"
								? ANTIGRAVITY_HEADERS
								: undefined),
						},
						body: JSON.stringify(requestBody),
						signal,
					});

					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(
							`Image request failed (${response.status}): ${errorText}`,
						);
					}

					const parsed = await parseSseForImage(response, signal);
					const preparedImage = await prepareToolResultImage(
						parsed.image,
						// [ref:antigravity_svg_fallback_requires_raster_preview]
						rasterizeSvgToPng,
					);
					const originalMimeType =
						preparedImage.previewMode === "native"
							? undefined
							: parsed.image.mimeType;
					let savedPaths: string[] | undefined;
					let saveError: string | undefined;
					if (saveConfig.mode !== "none" && saveConfig.outputDir) {
						try {
							savedPaths = await saveGeneratedArtifacts(
								preparedImage,
								saveConfig.outputDir,
							);
						} catch (error) {
							saveError =
								error instanceof Error ? error.message : String(error);
						}
					}

					return {
						content: [
							{
								type: "text",
								text: buildGeneratedImageSummary({
									providerLabel,
									model: attempt.model,
									aspectRatio,
									source: parsed.source,
									savedPaths,
									saveError,
									textParts: parsed.text,
									previewMode: preparedImage.previewMode,
								}),
							},
							{
								type: "image",
								data: preparedImage.attachmentImage.data,
								mimeType: preparedImage.attachmentImage.mimeType,
							},
						],
						details: {
							provider: providerLabel,
							model: attempt.model,
							aspectRatio,
							savedPath: savedPaths?.[0],
							savedPaths,
							saveMode: saveConfig.mode,
							transport: attempt.transport,
							source: parsed.source,
							previewMode: preparedImage.previewMode,
							attachmentMimeType: preparedImage.attachmentImage.mimeType,
							originalMimeType,
							savedMimeType: preparedImage.savedImage.mimeType,
						},
					};
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					errors.push(`${providerLabel}/${attempt.model}: ${message}`);
					if (
						attempt.transport === "vertex" &&
						// [ref:antigravity_vertex_image_fallback]
						isVertexUnavailableError(message)
					) {
						skipRemainingVertexAttempts = true;
					}
				}
			}

			throw new Error(
				`Image generation failed after ${attempts.length} attempt(s). ${errors.join(" ")}`,
			);
		},
	});
}
