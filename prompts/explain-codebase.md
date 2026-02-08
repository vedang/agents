---
description: Build an interactive codebase explainer aligned with the playground skill
---

Use the `skills/playground/SKILL.md` workflow for this request.

Build a self-contained interactive HTML playground for: $@

1. Choose a short name and create `.agents/explainers/<short-name>.html`.
2. Select the closest playground template from `skills/playground/templates/`:
   - Prefer `code-map.md` for codebase architecture explainers.
   - Use another template only if it better matches the user’s goal.
3. Follow the playground core requirements:
   - single HTML file (inline CSS/JS, no external deps)
   - live preview/canvas updates on every control change
   - natural-language prompt output with a copy button
   - sensible defaults and 3-5 presets
4. Keep the generated playground compatible with light/dark/system appearance modes.
5. After writing the file, open it with: `open .agents/explainers/<short-name>.html`.
6. Return a short summary of what was built and which template was used.
