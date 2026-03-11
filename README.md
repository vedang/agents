# .config/agents

This is my Agent Harness configuration. Tell your agent to clone it to `~/.config/agents` and symlink the parts you want into your harness.

## Example commands for using agents configuration with the Pi Coding Agent

1. `git clone https://github.com/vedang/agents ~/.config/agents`
2. `mkdir -p ~/.pi/agent`
3. `ln -s ~/.config/agents/AGENTS.md ~/.pi/agent/AGENTS.md`
4. `ln -s ~/.config/agents/APPEND_SYSTEM.md ~/.pi/agent/APPEND_SYSTEM.md`
5. `ln -s ~/.config/agents/agents ~/.pi/agent/agents`
6. `ln -s ~/.config/agents/prompts ~/.pi/agent/prompts`
7. `ln -s ~/.config/agents/pi-extensions ~/.pi/agent/extensions`
8. `ln -s ~/.config/agents/skills ~/.pi/agent/skills`

## The configuration

| Entry                               | What it does                                                       |
| ----------------------------------- | ------------------------------------------------------------------ |
| `.`                                 | Config root.                                                       |
| `├─ AGENTS.md`                      | Global workflow rules (jj commits, tests, planning, tagref).       |
| `├─ APPEND_SYSTEM.md`               | Extra system prompt rules for subagent delegation.                 |
| `├─ agents/`                        | Role-card definitions for specialized subagents.                   |
| `│  ├─ scout.md`                    | Fast codebase recon and structured handoff context.                |
| `│  ├─ planner.md`                  | Turns requirements into concrete implementation plans.             |
| `│  ├─ worker.md`                   | Executes scoped coding tasks with full tool access.                |
| `│  ├─ reviewer.md`                 | Reviews code for quality, bugs, and security issues.               |
| `│  ├─ plan-reviewer.md`            | Critiques plans for missing steps and risk.                        |
| `│  ├─ librarian.md`                | Pulls external docs and best-practice guidance.                    |
| `│  ├─ multimodal.md`               | Analyzes PDFs/images/media for implementation details.             |
| `├─ prompts/`                       | Reusable prompt templates for common workflows.                    |
| `│  ├─ scout-and-plan.md`           | Scouts code, drafts a plan, then reviews the plan.                 |
| `│  ├─ implement-plan.md`           | Executes plans task-by-task via chained subagents.                 |
| `│  ├─ explain-codebase.md`         | Delegates interactive codebase explainer generation to playground. |
| `├─ pi-extensions/`                 | Runtime extensions that add commands/tools/UI behaviors.           |
| `│  ├─ confirm-destructive.ts`      | Confirms destructive clear/switch/fork actions.                    |
| `│  ├─ explanatory-output-style.ts` | Ports Claude explanatory style into pi system prompts.             |
| `│  ├─ handoff.ts`                  | Builds focused handoff prompts for new sessions.                   |
| `│  ├─ mac-system-theme.ts`         | Syncs Pi theme with macOS light/dark mode.                         |
| `│  ├─ notify.ts`                   | Sends terminal-native notifications when the agent is done.        |
| `│  ├─ status-line.ts`              | Shows persistent footer status updates across turns.               |
| `├─ pi-packages/`                   | External packages loaded via pi-settings.json.                     |
| `│  ├─ pi-antigravity-image-gen`    | Adds image generation via Google Antigravity + Vertex fallbacks.   |
| `│  ├─ pi-askuserquestion`          | Interactive question prompts via `ask_user_question` tool.         |
| `│  ├─ pi-boomerang`                | Token-efficient context collapsing for large tasks.                |
| `│  ├─ pi-custom-provider-zai`      | Registers Cerebras/ZAI-hosted GLM models as a custom provider.     |
| `│  ├─ pi-interactive-shell`        | Run interactive CLI agents in overlay TUI.                         |
| `│  ├─ pi-learn-stuff`              | Adds mandatory lessons-block output style with persistence hooks.  |
| `│  ├─ pi-prompt-history`           | Ctrl-R style prompt-history search across pi sessions.             |
| `│  ├─ pi-quizme`                   | Quizzes understanding of session changes and grades answers.       |
| `│  ├─ pi-read-map`                 | Enhanced file reading with structure maps for large files.         |
| `│  ├─ pi-simplify-code`            | Refines changed code while preserving behavior.                    |
| `│  ├─ pi-subagents`                | Scout, planner, worker, reviewer subagent definitions.             |
| `│  ├─ pi-web-access`               | Web search, fetch content, librarian research skill.               |
| `│  ├─ visual-explainer`            | Generate HTML pages to visually explain systems/data.              |
| `├─ skills/`                        | Optional skill packages for specialized capabilities.              |
| `│  ├─ dev-browser/`                | Persistent browser automation workflows and helpers.               |
| `│  ├─ docx/`                       | Creates, edits, and analyzes Word `.docx` documents.               |
| `│  ├─ frontend-design/`            | Crafts distinctive, production-grade frontend interfaces.          |
| `│  ├─ pdf/`                        | Handles PDF extraction, editing, forms, merging, and OCR.          |
| `│  ├─ playground/`                 | Builds interactive single-file HTML explorers with prompt output.  |
| `│  ├─ pptx/`                       | Creates, edits, and analyzes PowerPoint `.pptx` presentations.     |
| `│  ├─ skill-creator/`              | Guides creation and maintenance of high-quality skills.            |
| `│  ├─ xlsx/`                       | Creates and edits spreadsheets with formula-safe workflows.        |
