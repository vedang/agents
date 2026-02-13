# Simplify-Code Extension

Automatically triggers code simplification after non-markdown code changes, using the `simplify-code` prompt template.

## Features

- **Auto-Trigger**: Automatically runs after non-markdown code changes
- **Project Standards**: Applies patterns from your `AGENTS.md` (ES modules, type annotations, etc.)
- **Smart Detection**: Skips if only markdown files were changed
- **Manual Trigger**: Use `/simplify-code` command anytime

## How It Works

### Extension Behavior

The extension tracks file changes during an agent session:

1. **Path Tracking**: Every time `write`, `edit`, or `apply_patch` tools are called, the extension records the modified file paths
2. **Auto-Trigger Check**: At `agent_end`, the extension checks:
   - Whether any files were modified
   - Whether any non-markdown files were modified (`.md`, `.mdx`, `.markdown` are skipped)
   - Whether the trigger came from the extension itself (to avoid loops)
3. **Follow-up Message**: If conditions are met, sends a follow-up message like:
   ```
   /simplify-code The following code paths have changed:
     - src/api/client.ts
     - src/utils/helpers.ts
     - tests/example.test.ts
   ```

### Prompt Template

The simplification behavior is defined in `prompts/simplify-code.md`. This prompt template:

- Contains the refinement instructions for the LLM
- Can be invoked manually with `/simplify-code [context]`
- Applies project-specific best practices from `AGENTS.md`

## Commands

### `/simplify-code [context]`

Manually trigger code simplification with optional context:

```bash
/simplify-code
/simplify-code Focus on the auth module
/simplify-code The following files need review: src/auth.ts src/session.ts
```

The context is appended to the prompt instructions and provides additional guidance to the LLM.

## What It Does

The prompt template refines code to improve:
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
3. The trigger didn't come from the extension itself (prevents loops)

## Configuration

Customize simplification behavior by editing `prompts/simplify-code.md`:
- Adjust refinement priorities
- Add project-specific rules
- Modify the balance between simplicity and clarity

## Architecture

```
Extension (pi-extensions/simplify-code/index.ts)
  ↓
  Tracks file changes via tool_call events
  ↓
  At agent_end, sends: /simplify-code [paths]
  ↓
Prompt Template (prompts/simplify-code.md)
  ↓
  Expanded and sent to LLM
  ↓
  LLM simplifies the changed code
```

This separation of concerns allows:
- Extension: Handles state tracking and timing
- Prompt: Defines simplification behavior
- Users: Can invoke `/simplify-code` manually with custom context

## Notes

- Skips markdown-only changes ([ref: simplify_code_skip_markdown_only])
- The `/simplify-code` command is a prompt template, not an extension command
- Changes are committed after simplification by the LLM