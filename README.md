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
| [PR spec audit](skills/pr-spec-audit/SKILL.md) | Audit every production file in a PR against its spec for boundary, null/empty, authorization, injection, and state risks. Two independent subagent runs are reconciled into one editable Markdown decision list. |
| [To design](skills/to-design/SKILL.md) | Turn a spec or grill-me conversation into a concrete technical design with a file map, UML, interfaces, and worked examples. |

To install the skill for Codex and Claude Code, link it into the shared `~/.agents/skills/` directory and point Claude at that link:

```sh
ln -s "$PWD/skills/pr-spec-audit" ~/.agents/skills/pr-spec-audit
ln -s ~/.agents/skills/pr-spec-audit ~/.claude/skills/pr-spec-audit
```

Invoke it as `$pr-spec-audit` in Codex or `/pr-spec-audit` in Claude Code, with a PR URL or fixed Git diff. The reports are written in English outside the target repository.

## License

MIT. See [LICENSE](LICENSE).
