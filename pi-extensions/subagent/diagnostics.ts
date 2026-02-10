export interface ToolCallDiagnostic {
	name: string;
	argumentsPreview?: string;
}

export interface ToolResultDiagnostic {
	toolName: string;
	isError: boolean;
	preview?: string;
}

export interface DiagnosticEventSnapshot {
	type: string;
	timestamp?: number | string;
	role?: string;
	stopReason?: string;
	toolName?: string;
	isError?: boolean;
	preview?: string;
}

export interface SubagentFailureDiagnostics {
	capturedAt: string;
	errorMessage?: string;
	stopReason?: string;
	exitCode: number;
	statusCode?: number;
	bodyDescriptor?: string;
	hasNoBody?: boolean;
	retryable?: boolean;
	requestedProvider?: string;
	requestedModel?: string;
	runtimeProvider?: string;
	runtimeModel?: string;
	eventCounts: {
		parsed: number;
		messageEnd: number;
		toolResultEnd: number;
	};
	recentEvents: DiagnosticEventSnapshot[];
	lastToolCall?: ToolCallDiagnostic;
	lastToolResult?: ToolResultDiagnostic;
	stderrTail?: string;
}

export interface BuildFailureDiagnosticsParams {
	errorMessage?: string;
	stopReason?: string;
	exitCode: number;
	requestedProvider?: string;
	requestedModel?: string;
	runtimeProvider?: string;
	runtimeModel?: string;
	parsedEventCount: number;
	messageEndCount: number;
	toolResultEndCount: number;
	recentEvents: DiagnosticEventSnapshot[];
	lastToolCall?: ToolCallDiagnostic;
	lastToolResult?: ToolResultDiagnostic;
	stderr?: string;
}

const MAX_STDERR_TAIL_CHARS = 4000;

export function clipText(value: string, maxChars = 240): string {
	if (value.length <= maxChars) return value;
	return `${value.slice(0, maxChars)}…`;
}

export function parseProviderError(errorMessage?: string): {
	statusCode?: number;
	bodyDescriptor?: string;
	hasNoBody?: boolean;
	retryable?: boolean;
} {
	if (!errorMessage) return {};

	const statusMatch = errorMessage.match(/\b([1-5]\d{2})\b/);
	const statusCode = statusMatch ? Number.parseInt(statusMatch[1], 10) : undefined;
	const bodyMatch = errorMessage.match(/\(([^)]*)\)/);
	const bodyDescriptor = bodyMatch?.[1]?.trim();

	const hasNoBody = bodyDescriptor?.toLowerCase() === "no body" ? true : undefined;

	let retryable: boolean | undefined;
	if (statusCode !== undefined) {
		retryable = statusCode >= 500 || statusCode === 429;
	}

	return {
		statusCode,
		bodyDescriptor,
		hasNoBody,
		retryable,
	};
}

export function stderrTail(stderr: string | undefined, maxChars = MAX_STDERR_TAIL_CHARS): string | undefined {
	if (!stderr) return undefined;
	if (stderr.length <= maxChars) return stderr;
	return `…${stderr.slice(stderr.length - maxChars)}`;
}

export function pushRecentEvent(
	events: DiagnosticEventSnapshot[],
	event: DiagnosticEventSnapshot,
	maxEvents = 25,
): void {
	events.push(event);
	if (events.length > maxEvents) {
		events.splice(0, events.length - maxEvents);
	}
}

export function buildFailureDiagnostics(params: BuildFailureDiagnosticsParams): SubagentFailureDiagnostics {
	const providerError = parseProviderError(params.errorMessage);
	return {
		capturedAt: new Date().toISOString(),
		errorMessage: params.errorMessage,
		stopReason: params.stopReason,
		exitCode: params.exitCode,
		statusCode: providerError.statusCode,
		bodyDescriptor: providerError.bodyDescriptor,
		hasNoBody: providerError.hasNoBody,
		retryable: providerError.retryable,
		requestedProvider: params.requestedProvider,
		requestedModel: params.requestedModel,
		runtimeProvider: params.runtimeProvider,
		runtimeModel: params.runtimeModel,
		eventCounts: {
			parsed: params.parsedEventCount,
			messageEnd: params.messageEndCount,
			toolResultEnd: params.toolResultEndCount,
		},
		recentEvents: params.recentEvents,
		lastToolCall: params.lastToolCall,
		lastToolResult: params.lastToolResult,
		stderrTail: stderrTail(params.stderr),
	};
}
