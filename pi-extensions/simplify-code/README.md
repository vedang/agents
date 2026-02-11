# Simplify Code

Automatically simplifies and refines code after significant changes, following project-specific best practices from `AGENTS.md`.

(This extension is a re-implementation of the Claude Code code-simplifier skill)

## Features

- **Auto-Trigger**: Automatically runs after non-markdown code changes
- **Project Standards**: Applies patterns from your `AGENTS.md` (ES modules, type annotations, etc.)
- **Smart Detection**: Skips if only markdown files were changed
- **Manual Trigger**: Use `/simplify-code` command anytime

## Commands

### `/simplify-code [reason]`

Manually trigger code simplification with optional context:

```bash
/simplify-code
/simplify-code agent_end
```

## What It Does

The extension refines code to improve:
- **Clarity**: Reduces unnecessary complexity and nesting
- **Consistency**: Applies project-wide coding standards
- **Maintainability**: Improves variable/function names and structure
- **Balance**: Avoids over-simplification that harms readability

### Specific Rules

- Preserves exact functionality (never changes behavior)
- Prefers `function` keyword over arrow functions
- Uses explicit return type annotations
- Avoids nested ternary operators (use switch/if-else instead)
- Removes redundant comments for obvious code
- Chooses clarity over brevity

## Auto-Trigger Behavior

The extension automatically triggers after `agent_end` events when:
1. At least one file was modified
2. At least one non-markdown file was modified (`.md`, `.mdx`, `.markdown` are skipped)

## Configuration

Customize simplification behavior by editing `pi-extensions/simplify-code/prompt.md`:
- Adjust refinement priorities
- Add project-specific rules
- Modify the balance between simplicity and clarity

## Notes

- Skips markdown-only changes ( [ref: simplify_code_skip_markdown_only])
- Requires the `/simplify-code` command to be available
- Changes are committed after simplification
