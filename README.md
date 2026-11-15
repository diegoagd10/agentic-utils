# Agentic Utils

Reusable prompts and skills for coding agents.

## Prompts

| Prompt | Purpose |
| --- | --- |
| [Local Markdown issue tracker](prompts/local-markdown-issue-tracker.md) | Configure Matt Pocock's engineering skills to keep specs and tickets in local Markdown files outside Git. |

To use the local Markdown tracker prompt, run `/setup-matt-pocock-skills` in the target repository. Choose **Other** when asked for an issue tracker, then paste the contents of the prompt file. The setup creates `docs/agents/issue-tracker.md` in that repository and links it from its agent instructions.

The prompt comes from [Cairn's `alternative` branch README](https://github.com/diegoagd10/cairn/blob/alternative/README.md).

## Skills

Add reusable skills under `skills/<skill-name>/SKILL.md`. See [skills/README.md](skills/README.md) for the layout.

| Skill | Purpose |
| --- | --- |
| [To story](skills/to-story/SKILL.md) | Turn a feature or a bug found by hand into a user story with Given/When/Then acceptance criteria, agreed before any test or code is written. |
| [To tests](skills/to-tests/SKILL.md) | Turn the approved story's scenarios into failing tests that fail for the expected reason, then stop for review before any production code. |
| [To code](skills/to-code/SKILL.md) | Make the committed tests pass without changing them, run the project's quality gate, and run and ship the app on request. |
| [To build](skills/to-build/SKILL.md) | Run tests, an independent test check (Sonnet), code, a code review (Fable) and a refactor on its own after the story is approved, using subagents, with saved evidence for every step, and hand back a flow diagram to review. |

### Two ways to run the flow

- **On its own:** `/to-story` → `/to-build` → review. You decide the story and review the result. In between, each phase passes or fails a check, and the evidence is saved.
- **Step by step:** `/to-story` → `/to-tests` → `/to-code`, stopping for your review after each phase. `/to-build` follows these two skills as its rule book.

## License

MIT. See [LICENSE](LICENSE).
