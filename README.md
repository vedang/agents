# .config/agents

This is my Agent Harness configuration. Tell your agent to clone it to `~/.config/agents` and symlink the parts you want into your harness.

## Example commands for using agents configuration with the Pi Coding Agent

1. `git clone https://github.com/vedang/agents ~/.config/agents`
2. `mkdir -p ~/.pi/agent`
3. `ln -s ~/.config/agents/AGENTS.md ~/.pi/agent/AGENTS.md`
4. `ln -s ~/.config/agents/APPEND_SYSTEM.md ~/.pi/agent/APPEND_SYSTEM.md`
5. `ln -s ~/.config/agents/pi-settings.json ~/.pi/agent/settings.json`
5. `ln -s ~/.config/agents/agents ~/.pi/agent/agents`
6. `ln -s ~/.config/agents/prompts ~/.pi/agent/prompts`
7. `ln -s ~/.config/agents/pi-extensions ~/.pi/agent/extensions`
8. `ln -s ~/.config/agents/skills ~/.pi/agent/skills`

## The configuration

### Root Configuration Files

| File                                   | Description                                                  |
|----------------------------------------|--------------------------------------------------------------|
| [`AGENTS.md`](AGENTS.md)               | Global workflow rules (jj commits, tests, planning, tagref). |
| [`APPEND_SYSTEM.md`](APPEND_SYSTEM.md) | Extra system prompt rules for subagent delegation.           |
| [`pi-settings.json`](pi-settings.json) | Main Pi configuration file.                                  |

### agents/

Subagent role-card definitions for specialized tasks.

| File                                          | Description                                                    |
|-----------------------------------------------|----------------------------------------------------------------|
| [`scout.md`](agents/scout.md)                 | Fast codebase recon and structured handoff context.            |
| [`planner.md`](agents/planner.md)             | Turns requirements into concrete implementation plans.         |
| [`worker.md`](agents/worker.md)               | Executes scoped coding tasks with full tool access.            |
| [`reviewer.md`](agents/reviewer.md)           | Reviews code for quality, bugs, and security issues.           |
| [`plan-reviewer.md`](agents/plan-reviewer.md) | Critiques plans for missing steps and risk.                    |
| [`researcher.md`](agents/researcher.md)       | Searches, evaluates, and synthesizes a focused research brief. |
| [`multimodal.md`](agents/multimodal.md)       | Analyzes PDFs/images/media for implementation details.         |

### prompts/

Reusable prompt templates for common workflows.

| File                                                         | Description                                        |
|--------------------------------------------------------------|----------------------------------------------------|
| [`scout-and-plan.chain.md`](prompts/scout-and-plan.chain.md) | Scouts code, drafts a plan, then reviews the plan. |
| [`implement-plan.chain.md`](prompts/implement-plan.chain.md) | Executes plans task-by-task via chained subagents. |

### pi-extensions/

Runtime extensions that add commands/tools/UI behaviors.

| File                                                                       | Description                                                 |
|----------------------------------------------------------------------------|-------------------------------------------------------------|
| [`confirm-destructive.ts`](pi-extensions/confirm-destructive.ts)           | Confirms destructive clear/switch/fork actions.             |
| [`explanatory-output-style.ts`](pi-extensions/explanatory-output-style.ts) | Ports Claude explanatory style into pi system prompts.      |
| [`handoff.ts`](pi-extensions/handoff.ts)                                   | Builds focused handoff prompts for new sessions.            |
| [`mac-system-theme.ts`](pi-extensions/mac-system-theme.ts)                 | Syncs Pi theme with macOS light/dark mode.                  |
| [`notify.ts`](pi-extensions/notify.ts)                                     | Sends terminal-native notifications when the agent is done. |
| [`status-line.ts`](pi-extensions/status-line.ts)                           | Shows persistent footer status updates across turns.        |

### pi-packages/

External packages loaded via pi-settings.json.

| Package                    | Description                                                       | GitHub                                                                                |
|----------------------------|-------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| `pi-askuserquestion`       | Interactive question prompts via `ask_user_question` tool.        | [ghoseb/pi-askuserquestion](https://github.com/ghoseb/pi-askuserquestion)             |
| `pi-antigravity-image-gen` | Adds image generation via Google Antigravity + Vertex fallbacks.  | [vedang/pi-antigravity-image-gen](https://github.com/vedang/pi-antigravity-image-gen) |
| `pi-boomerang`             | Token-efficient context collapsing for large tasks.               | [vedang/pi-boomerang](https://github.com/vedang/pi-boomerang)                         |
| `pi-custom-provider-zai`   | Registers Cerebras/ZAI-hosted GLM models as a custom provider.    | [vedang/pi-custom-provider-zai](https://github.com/vedang/pi-custom-provider-zai)     |
| `pi-interactive-shell`     | Run interactive CLI agents in overlay TUI.                        | [nicobailon/pi-interactive-shell](https://github.com/nicobailon/pi-interactive-shell) |
| `pi-learn-stuff`           | Adds mandatory lessons-block output style with persistence hooks. | [vedang/pi-learn-stuff](https://github.com/vedang/pi-learn-stuff)                     |
| `pi-prompt-history`        | Ctrl-R style prompt-history search across pi sessions.            | [vedang/pi-prompt-history](https://github.com/vedang/pi-prompt-history)               |
| `pi-quizme`                | Quizzes understanding of session changes and grades answers.      | [vedang/pi-quizme](https://github.com/vedang/pi-quizme)                               |
| `pi-read-map`              | Enhanced file reading with structure maps for large files.        | [Whamp/pi-read-map](https://github.com/Whamp/pi-read-map)                             |
| `pi-simplify-code`         | Refines changed code while preserving behavior.                   | [vedang/pi-simplify-code](https://github.com/vedang/pi-simplify-code)                 |
| `pi-subagents`             | Extension to enable subagent delegation.                          | [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents)                 |
| `pi-web-access`            | Web search, fetch content, librarian research skill.              | [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access)               |
| `visual-explainer`         | Generate HTML pages to visually explain systems/data.             | [vedang/visual-explainer](https://github.com/vedang/visual-explainer)                 |

### skills/

Optional skill packages for specialized capabilities.

| Skill                                         | Description                                                       |
|-----------------------------------------------|-------------------------------------------------------------------|
| [`dev-browser/`](skills/dev-browser/)         | Persistent browser automation workflows and helpers.              |
| [`docx/`](skills/docx/)                       | Creates, edits, and analyzes Word `.docx` documents.              |
| [`frontend-design/`](skills/frontend-design/) | Crafts distinctive, production-grade frontend interfaces.         |
| [`pdf/`](skills/pdf/)                         | Handles PDF extraction, editing, forms, merging, and OCR.         |
| [`playground/`](skills/playground/)           | Builds interactive single-file HTML explorers with prompt output. |
| [`pptx/`](skills/pptx/)                       | Creates, edits, and analyzes PowerPoint `.pptx` presentations.    |
| [`skill-creator/`](skills/skill-creator/)     | Guides creation and maintenance of high-quality skills.           |
| [`xlsx/`](skills/xlsx/)                       | Creates and edits spreadsheets with formula-safe workflows.       |
