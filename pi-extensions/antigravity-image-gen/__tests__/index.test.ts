import assert from "node:assert/strict";
import test from "node:test";

import {
	CURRENT_GOOGLE_IMAGE_MODELS,
	DEFAULT_VERTEX_IMAGE_MODEL,
	FALLBACK_ANTIGRAVITY_MODEL,
	buildAntigravityFallbackPrompt,
	buildGeneratedImageSummary,
	buildModelAttempts,
	buildVertexImageRequest,
	extractImageDataUri,
	imageExtension,
} from "../core";

test("buildModelAttempts prioritizes current Google image models before antigravity fallback", () => {
	const attempts = buildModelAttempts();

	assert.deepEqual(
		attempts.map((attempt) => [attempt.transport, attempt.model]),
		[
			["vertex", "gemini-3.1-flash-image-preview"],
			["vertex", "gemini-3-pro-image-preview"],
			["vertex", "gemini-2.5-flash-image"],
			["antigravity", "gemini-3.1-pro-high"],
		],
	);
	assert.equal(CURRENT_GOOGLE_IMAGE_MODELS[0], DEFAULT_VERTEX_IMAGE_MODEL);
	assert.equal(
		attempts[attempts.length - 1]?.model,
		FALLBACK_ANTIGRAVITY_MODEL,
	);
});

test("buildModelAttempts preserves explicit vertex image model requests", () => {
	const attempts = buildModelAttempts("gemini-3-pro-image-preview");

	assert.deepEqual(attempts, [
		{
			transport: "vertex",
			model: "gemini-3-pro-image-preview",
		},
	]);
});

test("buildModelAttempts preserves explicit antigravity model requests", () => {
	const attempts = buildModelAttempts("gemini-3.1-pro-high");

	assert.deepEqual(attempts, [
		{
			transport: "antigravity",
			model: "gemini-3.1-pro-high",
		},
	]);
});

test("buildVertexImageRequest uses image-only response modalities with aspect ratio and image size", () => {
	const request = buildVertexImageRequest("A tiny red square icon.", "16:9");

	assert.deepEqual(request, {
		contents: [
			{
				role: "user",
				parts: [{ text: "A tiny red square icon." }],
			},
		],
		generationConfig: {
			responseModalities: ["IMAGE"],
			imageConfig: {
				aspectRatio: "16:9",
				imageSize: "1K",
			},
		},
	});
});

test("buildAntigravityFallbackPrompt requests a single data URI image with aspect ratio guidance", () => {
	const prompt = buildAntigravityFallbackPrompt(
		"A cozy fox reading in a library.",
		"1:1",
	);

	assert.match(prompt, /Respond with exactly one Markdown image/);
	assert.match(prompt, /data:image\//);
	assert.match(prompt, /Prefer SVG/);
	assert.match(prompt, /Target aspect ratio: 1:1/);
	assert.match(prompt, /A cozy fox reading in a library\./);
});

test("extractImageDataUri parses base64 markdown image data", () => {
	const parsed = extractImageDataUri(
		"Here you go!\n\n![Tiny Red Square](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)",
	);

	assert.deepEqual(parsed, {
		mimeType: "image/svg+xml",
		data: "PHN2Zz48L3N2Zz4=",
		encoding: "base64",
	});
});

test("extractImageDataUri parses url-encoded data URIs", () => {
	const parsed = extractImageDataUri(
		"![Tiny Red Square](data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22/%3E)",
	);

	assert.deepEqual(parsed, {
		mimeType: "image/svg+xml",
		data: "%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22/%3E",
		encoding: "uri",
	});
});

test("imageExtension preserves svg files when svg mime types are returned", () => {
	assert.equal(imageExtension("image/svg+xml"), "svg");
	assert.equal(imageExtension("image/png"), "png");
});

test("buildGeneratedImageSummary includes fallback, save path, and model notes", () => {
	const summary = buildGeneratedImageSummary({
		providerLabel: "google-antigravity",
		model: "gemini-3.1-pro-high",
		aspectRatio: "1:1",
		source: "data-uri",
		savedPath: "/repo/.pi/generated-images/fox.svg",
		textParts: ["A fox logo was generated."],
	});

	assert.equal(
		summary,
		"Generated image via google-antigravity/gemini-3.1-pro-high. Aspect ratio: 1:1. Decoded image from Antigravity text output fallback. Saved image to: /repo/.pi/generated-images/fox.svg Model notes: A fox logo was generated.",
	);
});

test("buildGeneratedImageSummary omits optional sections when they are unavailable", () => {
	const summary = buildGeneratedImageSummary({
		providerLabel: "google-vertex",
		model: "gemini-3.1-flash-image-preview",
		aspectRatio: "16:9",
		source: "inline-data",
		saveError: "disk full",
		textParts: [],
	});

	assert.equal(
		summary,
		"Generated image via google-vertex/gemini-3.1-flash-image-preview. Aspect ratio: 16:9. Failed to save image: disk full",
	);
});
