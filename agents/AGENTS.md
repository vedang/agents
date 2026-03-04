## Lessons

- **Declarative Configuration Beats Imperative Instructions**: Moving from "write to X path in task" to `output: X` in frontmatter makes workflows more maintainable and less error-prone
- **Three-State Semantics Enable Flexibility**: Supporting undefined/inherit, value/override, and false/disable for optional fields provides fine-grained control without complexity
- **Documentation is Part of Migration**: Creating a comprehensive migration guide helps users understand the "why" behind changes, not just the "how"

- **Helper Functions as Middleware**: Adding a thin layer of abstraction (helpers) can solve cross-cutting concerns (session tracking) without modifying core code
- **Documentation in Code Files**: Adding usage examples directly in chain files serves as always-visible documentation that's updated alongside the code
- **Progressive Enhancement**: Provide multiple solutions (simple helpers → extension modification) so users can choose based on their needs and comfort level
