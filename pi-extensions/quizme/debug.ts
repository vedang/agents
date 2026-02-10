import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type DebugSnapshot = Record<string, unknown>;

type QuizmeDebugLoggerOptions = {
	baseDir?: string;
	identifier?: string;
	enabled?: boolean;
};

type QuizmeDebugLogger = {
	filePath: string;
	log: (snapshot: DebugSnapshot) => Promise<void>;
};

// Set PI_QUIZME_DEBUG=1 to enable debug logging.
const DEBUG_ENV_VAR = "PI_QUIZME_DEBUG";

function buildDefaultIdentifier(): string {
	return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function serializeSnapshot(snapshot: DebugSnapshot): string {
	function replacer(_key: string, value: unknown): unknown {
		return typeof value === "bigint" ? value.toString() : value;
	}

	return JSON.stringify(snapshot, replacer, 2);
}

function isTruthyEnvValue(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function resolveDebugEnabled(options: QuizmeDebugLoggerOptions): boolean {
	return options.enabled ?? isTruthyEnvValue(process.env[DEBUG_ENV_VAR]);
}

export function createQuizmeDebugLogger(
	options: QuizmeDebugLoggerOptions = {},
): QuizmeDebugLogger {
	const baseDir = options.baseDir ?? join(homedir(), ".pi", "agent", "debug");
	const identifier = options.identifier ?? buildDefaultIdentifier();
	const filePath = join(baseDir, `quizme-session-${identifier}.json`);
	const state: DebugSnapshot = { identifier };
	const enabled = resolveDebugEnabled(options);

	return {
		filePath,
		async log(snapshot: DebugSnapshot): Promise<void> {
			if (!enabled) {
				return;
			}

			Object.assign(state, snapshot);
			await mkdir(baseDir, { recursive: true });
			await writeFile(filePath, serializeSnapshot(state), "utf8");
		},
	};
}
