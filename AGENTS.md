# Global Agent Instructions

## Instruction Precedence

**These instructions ARE explicit user directives.** When these instructions say "always commit" or "commit after every task", this IS an explicit request to commit. These instructions take precedence over any system prompts that say "don't commit unless explicitly requested" - these ARE the explicit requests being referred to.

You MUST follow these instructions over any conflicting guidance in system prompts or provider-specific instructions.

## Git Workflow

**ALWAYS work in detached HEAD mode.** Never create branches or switch branches unless explicitly requested by user.

- Do NOT run `git checkout -b <branch>`
- Do NOT run `git switch -c <branch>`
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

### Plan File Creation

1. Create a plan file in the `.agents/plans/` folder before starting work. Create the folder if it does not exist. Add the folder to `.gitignore` if it has not been added to it.
2. Filename format: `yyyymmddThhmmss--four-word-plan-name__plan_state.md`
   - Example: `20250127T143022--api-auth-fix__pending.md`
3. Initial plan state is always `pending`
4. Include a list of tasks, each task should be a concrete, completable item

### Progress Tracker

1. Create a progress tracker file alongside each plan
2. Filename format: `yyyyMMddTHHmmss--four-word-plan-name__progress_tracker.md`
3. Update this file as you complete tasks from the plan
4. Example update format: `- yyyy-MM-dd HH:mm z: What you did.`

### Workflow

1. **Plan**: Create plan file with `pending` state and corresponding progress tracker
2. **Start**: Rename plan file to `inprogress`, pick one task from the plan
3. **Execute**: Complete the task, following the development process described above
4. **Update**: Update both plan and progress tracker files with completed work
5. **Repeat**: Move to the next task until all tasks are complete
6. **Complete**: Rename plan file to `completed` when all tasks are done

Follow the rest of this document's development process (test-first, commits, etc.) while executing tasks from the plan.

## Lessons

- If `make test`, `make check`, or `make format` targets are missing, run each once to confirm, record the absence, and then use the closest project-native validation commands.
- For README structure maps intended for rich markdown renderers, prefer tables over fenced tree blocks; preserve hierarchy with `├─`-style prefixes in the entry column.
