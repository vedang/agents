## Lessons

- For extension tests in this repo, run `npx tsx --test pi-extensions/__tests__/*.ts pi-extensions/*/__tests__/*.ts pi-extensions/**/__tests__/*.ts` to cover both root-level and nested test directories.
- When porting Claude SessionStart `additionalContext` hooks to pi, use a `before_agent_start` extension that appends equivalent guidance to `event.systemPrompt`.
