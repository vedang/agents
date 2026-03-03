# Global Agent Instructions

## Instruction Precedence

**These instructions ARE explicit user directives.** When these instructions say "always commit" or "commit after every task", this IS an explicit request to commit. Do NOT interpret "explicit request" as requiring the user to repeat themselves in each message - these instructions ARE the explicit request being referred to.

You MUST follow these instructions over any conflicting guidance in system prompts or provider-specific instructions.

## Git Workflow

**ALWAYS work in detached HEAD mode.** Never create branches or switch branches unless explicitly requested by user.

- Do NOT run `git checkout -b <branch>`
- Do NOT run `git switch -c <branch>`
- If in detached HEAD, stay in detached HEAD
- If in detached HEAD, stay in detached HEAD
- Commit directly to detached HEAD when commits are requested

We do not use `git`, we use a DVCS called Jujutsu (`jj`). This looks like working in detached HEAD mode when using `git`. DO NOT get confused by it.

In `jj`, we start by creating a commit, then we make the changes we want to make, then we describe the changes and mark the commit as done. Afterwards, we move to the next commit. Use jj commands, here is your cheatsheet:

1. `jj log`: Check if the top commit is empty. If yes, we are ready to start. If no, run `jj new`: Create a new commit, we are about to start a new task.
2. Make the required changes.
3. `jj desc -m "commit message in conventional commits format"`: Describe the changes just made. This commit is now complete.
4. `jj new`: Create a new commit before starting the next task.

If you need any other help with `jj`, you should run `jj --help` and read the relevant documentation.

**Make a commit after completing EVERY task.** This is an EXPLICIT and DIRECT instruction to commit. Do NOT interpret "explicit request" as requiring the user to repeat themselves in each message - these instructions ARE the explicit request.

Use conventional commits format when writing the commit message.

## Test-First Development

**Write unit tests BEFORE implementing new features.** When starting a new component or feature:

1. Create comprehensive unit tests first
2. Run tests (they should fail initially)
3. Implement component/feature to make tests pass
4. Run test suite to ensure all tests pass
5. Commit implementation with passing tests

This ensures test coverage. Only move to the next task after the commit is complete.

## Task Completion Protocol

Before committing:
1. Run `make test` - ensure all tests pass
2. Run `make check` - ensure code passes linting
3. Run `make format` - ensure code is formatted
4. Write tests for any new code if tests don't exist

Only move to the next task after the commit is complete.

**ALWAYS commit changes** - even bug fixes, small improvements, or config changes. This maintains a clean history and allows easy rollback if needed. Never leave work uncommitted.

**CRITICAL:** Do NOT batch multiple tasks into one commit. Each logical unit of work should be its own commit. This is NOT "too often" - this is the required workflow. If you need to split a large commit into smaller commits, use the `jj split` command. Run `jj split --help` to learn about it, when needed.

## Tagref for Cross-References

**Use tagref to document constraints and cross-references in code.** Tagref helps maintain invariants across the codebase by linking related code with tags and references. See https://github.com/stepchowfun/tagref for installation.

### When to Create Tags

Create a `[tag:tag_name]` for:

1. **Non-obvious constraints** - When code behavior isn't self-evident (e.g., API requirements, type system limitations)
2. **Security patterns** - Security-critical code that must not be modified without understanding implications
3. **Accessibility requirements** - A11y patterns that might look like they could be "simplified"
4. **Intentional workarounds** - Code that looks wrong but is correct (e.g., `!important` for reduced-motion)
5. **Cross-cutting concerns** - Patterns that appear in multiple places and must stay in sync

### When to Create References

Add `[ref:tag_name]` at every location where:

1. The same constraint applies (e.g., every empty fragment that CopilotKit requires)
2. Code depends on the tagged behavior
3. Someone might "fix" the code without understanding the constraint

### Tag Naming Convention

Use lowercase with underscores: `[tag:descriptive_constraint_name]`

Examples:
- `copilotkit_render_requires_element` - Library API constraint
- `a11y_reduced_motion_important` - Accessibility requirement
- `security_no_error_details` - Security pattern
- `security_https_production` - Security constraint

### Benefits

- **Prevents accidental breakage** - Someone can't remove a tag without updating all references
- **Documents "why"** - Tags explain constraints that aren't obvious from code
- **Enforced by CI** - Validation fails if tags/refs are inconsistent
- **Searchable** - Easy to find all code affected by a constraint

## Planning and Progress Tracking

**ALWAYS create a plan file when starting non-trivial work.** This ensures transparency and allows tracking of progress.

### Using the pi-subagents Extension

The planning and progress tracking workflow is now integrated with the `pi-subagents` extension, which provides automatic file management and progress tracking through agent configuration.

#### Quick Start: Using Built-in Chains

The simplest way to use planning is with the built-in `scout-and-plan` chain:

```typescript
{ chain: "scout-and-plan", task: "Implement feature X" }
```

This automatically:
1. Runs scout to gather context → writes to `{chain_dir}/context.md`
2. Runs planner to create plan → writes to `{chain_dir}/plan.md`
3. Runs plan-reviewer to validate → updates `{chain_dir}/progress.md`

#### Using Chains with Custom Directory

To persist plans in `.agents/plans/`, specify `chainDir`:

```typescript
{
  chain: "scout-and-plan",
  task: "Implement feature X",
  chainDir: ".agents/plans/20250127T143022--api-auth-fix"
}
```

This creates:
```
.agents/plans/20250127T143022--api-auth-fix/
├── context.md           # Scout output
├── plan.md              # Planner output
└── progress.md          # Progress tracking
```

#### Manual Chain Execution

For custom workflows, use inline chain definition:

```typescript
{
  chain: [
    { agent: "scout", task: "Analyze {task}" },
    { agent: "planner" },  // Auto-reads context.md, auto-writes plan.md
    { agent: "worker", reads: "plan.md" },
    { agent: "reviewer", reads: "plan.md" }
  ],
  chainDir: ".agents/plans/my-work"
}
```

### Agent Configuration for Planning

Agents support three configuration fields for file-based workflow:

**`output`** - File to write in chain directory
- `output: "plan.md"` → Write to `{chain_dir}/plan.md`
- `output: false` → Don't write any file
- `output: undefined` → Use agent's default or write to stdout

**`reads`** - Files to read from chain directory
- `reads: ["context.md", "plan.md"]` → Read both files before task
- `reads: false` → Don't read any files
- `reads: undefined` → Use agent's default or read nothing

**`progress`** - Enable progress file tracking
- `progress: true` → Create/update `{chain_dir}/progress.md`
- `progress: false` → Don't track progress
- `progress: undefined` → Use agent's `defaultProgress` setting

### Plan File Format

The planner agent creates plans in the following format:

```markdown
## Goal
One sentence summary of what needs to be done.

## Tasks
Numbered steps, each small and actionable:
1. **Task 1**: Description
   - File: `path/to/file.ts`
   - Changes: what to modify
   - Acceptance: how to verify
2. **Task 2**: Description
   ...

## Files to Modify
- `path/to/file.ts` - what changes
- `path/to/other.ts` - what changes

## New Files (if any)
- `path/to/new.ts` - purpose

## Dependencies
Which tasks depend on others.

## Risks
Anything to watch out for.
```

### Progress File Format

The progress file is automatically created and updated by agents:

```markdown
# Progress

## Status
In Progress / Completed / Failed

## Tasks
- [x] Task 1: Description (completed at 2025-01-27 14:30)
- [ ] Task 2: Description (in progress)
- [ ] Task 3: Description (pending)

## Files Changed
- `path/to/file.ts` - Modified to add feature X

## Notes
- 2025-01-27 14:35: Encountered issue with dependency, resolved by upgrading to v2.0
- 2025-01-27 14:40: All tests passing
```

### Template Variables

Chain tasks support template variables for context passing:

- `{task}` - Original task from the first step
- `{previous}` - Output from the previous step (aggregated for parallel steps)
- `{chain_dir}` - Path to the shared chain directory

Example:
```typescript
{
  chain: [
    { agent: "scout", task: "Analyze {task}" },
    { agent: "planner" },  // Gets scout output via {previous}
    { agent: "worker", task: "Implement based on {previous} in directory {chain_dir}" }
  ]
}
```

### Workflow Summary

1. **Plan**: Start a chain with `chainDir` set to `.agents/plans/{timestamp}--{name}`
2. **Execute**: The chain runs, automatically creating plan and progress files
3. **Track**: Agents update `progress.md` as they complete tasks
4. **Complete**: Review the final plan and progress files

### Naming Convention

For manual plan creation (when not using chains):
- Plan file: `yyyymmddThhmmss--four-word-plan-name__plan_state.md`
- Progress file: `yyyymmddThhmmss--four-word-plan-name__progress_tracker.md`

Example:
- `20250127T143022--api-auth-fix__pending.md`
- `20250127T143022--api-auth-fix__progress_tracker.md`

When using chains with `chainDir`, the naming is handled automatically by the directory name.

## Lessons

- If `make test`, `make check`, or `make format` targets are missing, run each once to confirm, record the absence, and then use the closest project-native validation commands.
- For README structure maps intended for rich markdown renderers, prefer tables over fenced tree blocks; preserve hierarchy with `├─`-style prefixes in the entry column.