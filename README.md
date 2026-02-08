# .config/agents

This is my Agent Harness configuration. Clone it to `~/.config/agents` and symlink the parts you want into your harness.

## Example commands for using unravel-team/agents configuration with the Pi Coding Agent

1. `git clone https://github.com/unravel-team/agents ~/.config/agents`
2. `ln -s ~/.pi/agent/AGENTS.md ~/.config/agents/AGENTS.md`
3. `ln -s ~/.pi/agent/APPEND_SYSTEM.md ~/.config/agents/APPEND_SYSTEM.md`
4. `ln -s ~/.pi/agent/agents ~/.config/agents/agents`
5. `ln -s ~/.pi/agent/prompts ~/.config/agents/prompts`
6. `ln -s ~/.pi/agent/extensions ~/.config/agents/pi-extensions`
7. `ln -s ~/.pi/agent/skills ~/.config/agents/skills`

## The configuration

| Entry                               | What it does                                                      |
|-------------------------------------|-------------------------------------------------------------------|
| `.`                                 | Config root.                                                      |
| `├─ AGENTS.md`                      | Global workflow rules (jj commits, tests, planning, tagref).      |
| `├─ APPEND_SYSTEM.md`               | Extra system prompt rules for subagent delegation.                |
| `├─ agents/`                        | Role-card definitions for specialized subagents.                  |
| `│  ├─ scout.md`                    | Fast codebase recon and structured handoff context.               |
| `│  ├─ planner.md`                  | Turns requirements into concrete implementation plans.            |
| `│  ├─ worker.md`                   | Executes scoped coding tasks with full tool access.               |
| `│  ├─ reviewer.md`                 | Reviews code for quality, bugs, and security issues.              |
| `│  ├─ plan-reviewer.md`            | Critiques plans for missing steps and risk.                       |
| `│  ├─ librarian.md`                | Pulls external docs and best-practice guidance.                   |
| `│  ├─ multimodal.md`               | Analyzes PDFs/images/media for implementation details.            |
| `├─ prompts/`                       | Reusable prompt templates for common workflows.                   |
| `│  ├─ scout-and-plan.md`           | Scouts code, drafts a plan, then reviews the plan.                |
| `│  ├─ implement-plan.md`           | Executes plans task-by-task via chained subagents.                |
| `│  ├─ simplify-code.md`            | Refines changed code while preserving behavior.                   |
| `│  ├─ explain-codebase.md`         | Generates an interactive codebase explainer site.                 |
| `├─ pi-extensions/`                 | Runtime extensions that add commands/tools/UI behaviors.          |
| `│  ├─ subagent/`                   | Runs delegated agents in single, parallel, or chain mode.         |
| `│  ├─ quizme/`                     | Quizzes understanding of session changes and grades answers.      |
| `│  ├─ learn-stuff/`                | Captures durable lessons into the closest AGENTS.md.              |
| `│  ├─ antigravity-image-gen.ts`    | Adds image generation via Antigravity models.                     |
| `│  ├─ confirm-destructive.ts`      | Confirms destructive clear/switch/fork actions.                   |
| `│  ├─ explanatory-output-style.ts` | Ports Claude explanatory style into pi system prompts.            |
| `│  ├─ handoff.ts`                  | Builds focused handoff prompts for new sessions.                  |
| `│  ├─ loop.ts`                     | Repeats follow-up turns until breakout conditions are met.        |
| `│  ├─ mac-system-theme.ts`         | Syncs Pi theme with macOS light/dark mode.                        |
| `│  ├─ notify.ts`                   | Sends terminal-native notifications when the agent is done.       |
| `│  ├─ protected-paths.ts`          | Blocks write/edit calls to sensitive paths.                       |
| `│  ├─ questionnaire.ts`            | Asks single or multi-question interactive prompts.                |
| `│  ├─ status-line.ts`              | Shows persistent footer status updates across turns.              |
| `│  ├─ todo.ts`                     | Adds branch-aware todos plus a `/todos` viewer.                   |
| `├─ skills/`                        | Optional skill packages for specialized capabilities.             |
| `│  ├─ dev-browser/`                | Persistent Playwright automation (server + extension relay).      |
| `│  ├─ docx/`                       | Creates, edits, and analyzes Word `.docx` documents.              |
| `│  ├─ frontend-design/`            | Crafts distinctive, production-grade frontend interfaces.         |
| `│  ├─ pdf/`                        | Handles PDF extraction, editing, forms, merging, and OCR.         |
| `│  ├─ playground/`                 | Builds interactive single-file HTML explorers with prompt output. |
| `│  ├─ pptx/`                       | Creates, edits, and analyzes PowerPoint `.pptx` presentations.    |
| `│  ├─ xlsx/`                       | Creates and edits spreadsheets with formula-safe workflows.       |
