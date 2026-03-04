# Migration Guide: pi-subagents Extension

This guide explains the changes made to integrate with the new `pi-subagents` extension.

## What Changed

### 1. AGENTS.md - Planning and Progress Tracking Section

**Before:** Manual instructions to create plan files in `.agents/plans/` with specific naming conventions.

**After:** Integrated with `pi-subagents` extension features:
- Use `chainDir` parameter to specify output directory
- Automatic file management via `output`, `reads`, and `progress` fields
- Template variables `{task}`, `{previous}`, `{chain_dir}` for context passing
- Built-in progress tracking via `defaultProgress: true`

### 2. Agent Definitions

All agent definitions updated to use extension features:

#### planner.md
- Added `defaultReads: context.md` - automatically reads context
- Added `output: plan.md` - automatically writes plan
- Removed manual file path instructions
- Added clear documentation of how the extension handles files

#### scout.md
- Added `output: context.md` - automatically writes context
- Removed manual file writing instructions
- Clarified that extension handles file paths

#### worker.md
- Added `defaultReads: plan.md` - automatically reads plan
- Already had `defaultProgress: true` ✓
- Added instructions for updating progress file
- Clarified automatic file handling

#### plan-reviewer.md
- Added `defaultReads: plan.md` - automatically reads plan
- Added progress tracking instructions
- Clarified automatic file handling

#### reviewer.md
- Added `defaultReads: plan.md,progress.md` - automatically reads both
- Already had `defaultProgress: true` ✓
- Added progress update instructions

#### context-builder.md
- Already had `output: context.md` ✓
- Clarified automatic file handling
- Updated instructions to reference chain directory

#### researcher.md
- Changed `output` to `output: research.md`
- Already had `defaultProgress: true` ✓
- Added progress tracking instructions
- Clarified automatic file handling

### 3. Chain Files

Updated and added new chain files:

#### scout-and-plan.chain.md
- Added `reads: context.md` to planner step
- Added `output: plan.md` to planner step
- Added `reads: plan.md` to plan-reviewer step

#### full-workflow.chain.md (NEW)
- Complete workflow: scout → planner → plan-reviewer → worker → reviewer
- All steps configured with proper `reads`, `output`, and `progress`

#### quick-plan.chain.md (NEW)
- Quick workflow: scout → planner (no review)
- For when you just need a plan without review

## How to Use

### Option 1: Use Built-in Chains

**Quick plan (no review):**
```typescript
{ chain: "quick-plan", task: "Implement feature X" }
```

**Plan with review:**
```typescript
{ chain: "scout-and-plan", task: "Implement feature X" }
```

**Full workflow (plan → implement → review):**
```typescript
{ chain: "full-workflow", task: "Implement feature X" }
```

### Option 2: Use Chains with Custom Directory

To persist plans in `.agents/plans/`:

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
├── context.md      # Scout output
├── plan.md         # Planner output
└── progress.md     # Progress tracking
```

### Option 3: Manual Chain Execution

For custom workflows:

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

### Option 4: Single Agent Execution

For individual tasks:

```typescript
{
  agent: "planner",
  task: "Create a plan for implementing feature X",
  chainDir: ".agents/plans/my-plan"
}
```

## Key Concepts

### Three-State Configuration

Optional fields support three states:
- `undefined` - Use agent's default
- `value` - Override with specific value
- `false` - Disable the feature

Example:
```typescript
// Override default reads
{ agent: "worker", reads: ["custom-context.md"] }

// Disable default reads
{ agent: "worker", reads: false }

// Use default reads (plan.md)
{ agent: "worker" }
```

### Template Variables

- `{task}` - Original task from first step
- `{previous}` - Output from previous step (aggregated for parallel)
- `{chain_dir}` - Path to shared chain directory

### Progress Tracking

Agents with `defaultProgress: true` automatically:
1. Create `progress.md` on first use
2. Update it as they work
3. Track task completion, files changed, and notes

## Migration Notes

### What You Don't Need to Do Anymore

- ❌ Manually instruct agents to "write to .agents/plans/"
- ❌ Construct file paths in task instructions
- ❌ Manually create progress files
- ❌ Track which files were written/read

### What the Extension Handles

- ✅ Automatic file path resolution relative to `chainDir`
- ✅ Automatic file reading via `reads` configuration
- ✅ Automatic file writing via `output` configuration
- ✅ Automatic progress file creation and updates
- ✅ Context passing via `{previous}` template variable

### What You Still Do

- ✅ Specify `chainDir` if you want custom output location
- ✅ Override `reads`, `output`, or `progress` per step if needed
- ✅ Use template variables in task strings
- ✅ Commit changes after each task (via jj)

## Comparison

### Old Way (Manual)

```typescript
{
  agent: "planner",
  task: "Create a plan and save to .agents/plans/my-plan.md"
}

// Agent instructions had to include:
// "Write the plan to .agents/plans/my-plan.md"
// "Create progress tracker at .agents/plans/my-plan-progress.md"
```

### New Way (Automatic)

```typescript
{
  agent: "planner",
  task: "Create a plan",
  chainDir: ".agents/plans/my-plan"
}

// Agent automatically:
// - Reads context.md if it exists
// - Writes plan.md
// - Creates/updates progress.md
```

## Benefits

1. **Less Boilerplate**: No need to repeat file paths in instructions
2. **More Reliable**: Extension handles file I/O correctly
3. **Better Discoverability**: Configuration is visible in frontmatter
4. **Flexible**: Easy to override per step if needed
5. **Consistent**: All agents follow the same pattern

## File Reference

Updated files:
- `AGENTS.md` - Updated planning and progress tracking section
- `agents/planner.md` - Added defaultReads, output, clarified extension usage
- `agents/scout.md` - Added output, clarified extension usage
- `agents/worker.md` - Added defaultReads, clarified extension usage
- `agents/plan-reviewer.md` - Added defaultReads, clarified extension usage
- `agents/reviewer.md` - Added defaultReads, clarified extension usage
- `agents/context-builder.md` - Clarified extension usage
- `agents/researcher.md` - Added output, clarified extension usage
- `agents/scout-and-plan.chain.md` - Added reads/output configuration
- `agents/full-workflow.chain.md` - NEW: Complete workflow chain
- `agents/quick-plan.chain.md` - NEW: Quick planning chain

## Next Steps

1. Try using the new chains:
   ```typescript
   { chain: "quick-plan", task: "Test the new workflow" }
   ```

2. Check the generated files in the chain directory

3. Customize chains as needed for your specific workflows

4. Create additional chains in `agents/` directory for reusable workflows