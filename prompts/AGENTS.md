## Lessons

- **Separate state from behavior**: Extensions should track state (what changed) while prompt templates define behavior (what to do)
- **Natural language beats opaque tokens**: Using descriptive messages like "The following code paths have changed:" instead of "agent_end" reduces confusion
- **Make commands discoverable**: Prompt templates in `prompts/` are visible and editable; extension-registered commands are hidden
