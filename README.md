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
| [PR contract audit](skills/pr-contract-audit/SKILL.md) | Audit every production file in a PR for boundary, null/empty, authorization, injection, and state risks, then produce an editable Markdown decision list. |
| [PR contract audit, reconciled](skills/pr-contract-audit-reconcile/SKILL.md) | Run two independent PR contract audits as subagents and reconcile them into one verified decision list. |

To install the PR contract audit skills for Codex and Claude Code, link it into the shared `~/.agents/skills/` directory and point Claude at that link:

```sh
ln -s "$PWD/skills/pr-contract-audit" ~/.agents/skills/pr-contract-audit
ln -s ~/.agents/skills/pr-contract-audit ~/.claude/skills/pr-contract-audit
ln -s "$PWD/skills/pr-contract-audit-reconcile" ~/.agents/skills/pr-contract-audit-reconcile
ln -s ~/.agents/skills/pr-contract-audit-reconcile ~/.claude/skills/pr-contract-audit-reconcile
```

Invoke it as `$pr-contract-audit` in Codex or `/pr-contract-audit` in Claude Code, with a PR URL or fixed Git diff. The audit writes an English Markdown report outside the target repository. Use `pr-contract-audit-reconcile` the same way to run two audits and get one reconciled report; it needs `pr-contract-audit` installed beside it.

## License

MIT. See [LICENSE](LICENSE).
