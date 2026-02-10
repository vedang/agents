type SubagentScope = "user" | "project" | "both";

interface SubagentTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

interface SubagentChainStep {
	agent: string;
	task: string;
}

interface SubagentParallelTask {
	agent: string;
	task: string;
}

interface SubagentRenderCallArgs {
	agentScope?: SubagentScope;
	agent?: string;
	task?: string;
	chain?: SubagentChainStep[];
	tasks?: SubagentParallelTask[];
}

export function buildSubagentCallText(
	args: SubagentRenderCallArgs,
	theme: SubagentTheme,
): string {
	const scope = args.agentScope ?? "user";

	if (args.chain && args.chain.length > 0) {
		let text =
			theme.fg("toolTitle", theme.bold("subagent ")) +
			theme.fg("accent", `chain (${args.chain.length} steps)`) +
			theme.fg("muted", ` [${scope}]`);
		for (let i = 0; i < args.chain.length; i++) {
			const step = args.chain[i];
			text +=
				"\n  " +
				theme.fg("muted", `${i + 1}.`) +
				" " +
				theme.fg("accent", step.agent) +
				theme.fg("dim", ` ${step.task}`);
		}
		return text;
	}

	if (args.tasks && args.tasks.length > 0) {
		let text =
			theme.fg("toolTitle", theme.bold("subagent ")) +
			theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
			theme.fg("muted", ` [${scope}]`);
		for (const task of args.tasks) {
			text += `\n  ${theme.fg("accent", task.agent)}${theme.fg("dim", ` ${task.task}`)}`;
		}
		return text;
	}

	const agentName = args.agent || "...";
	const task = args.task ?? "...";
	let text =
		theme.fg("toolTitle", theme.bold("subagent ")) +
		theme.fg("accent", agentName) +
		theme.fg("muted", ` [${scope}]`);
	text += `\n  ${theme.fg("dim", task)}`;
	return text;
}
