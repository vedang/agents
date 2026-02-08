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

| Part                           | What it does                                                                                                             |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `AGENTS.md`                    | Global workflow rules (jj commits, tests, planning, tagref).                                                             |
| `APPEND_SYSTEM.md`             | Adds subagent usage rules and delegation patterns.                                                                       |
| `agents/`                      | Role cards for scout, planner, worker, reviewer, librarian, and multimodal agents.                                       |
| `prompts/`                     | Reusable prompts for scouting, planning, implementation, simplification, and explainers.                                 |
| `pi-extensions/subagent/`      | Runs delegated agents in single, parallel, or chain mode.                                                                |
| `pi-extensions/learn-stuff/`   | Writes durable lessons into the closest `AGENTS.md`.                                                                     |
| `pi-extensions/quizme/`        | Quizzes understanding of session changes and grades answers.                                                             |
| `pi-extensions/` (other tools) | Adds `todo`, `questionnaire`, `loop`, `handoff`, notifications, path guards, theme/status helpers, and image generation. |
| `skills/dev-browser/`          | Persistent Playwright browser automation (standalone server + extension relay).                                          |
