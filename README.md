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
| [PR contract audit](skills/pr-contract-audit/SKILL.md) | Review a PR's behavioral assumptions and test evidence, then produce an editable Markdown report for product decisions. |

To install the PR contract audit skill for your user, copy its directory into `~/.codex/skills/`. Invoke it as `$pr-contract-audit` with a PR URL or fixed Git diff. The audit writes a Markdown draft outside the target repository until its decisions have been reviewed.

## License

MIT. See [LICENSE](LICENSE).
