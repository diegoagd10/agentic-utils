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
| [To design](skills/to-design/SKILL.md) | Write a short design discussion showing the shape of the code for review before implementation, and iterate on it through inline `FB:` comments. |
| [To design v2](skills/to-design-v2/SKILL.md) | Build the same design discussion part by part in a local review page, where three subagents propose approaches stacked full-width and you pick one or send feedback. |

## License

MIT. See [LICENSE](LICENSE).
