---
name: pr-spec-audit
description: Audit a PR against its spec for boundary, null/empty, authorization, injection, and state risks, using two independent subagent runs reconciled into one Markdown decision list.
disable-model-invocation: true
---

# PR spec audit

Two audits of the same diff surface different findings. This skill runs two **blind** audits as subagents and **reconciles** them into one report, so a finding survives on evidence rather than on which run happened to see it. The whole flow is read-only: production code, tests, and the user's checkout stay untouched.

[`AUDIT.md`](AUDIT.md) defines one audit run: categories, statuses, IDs, citations, and the report format. The subagents follow it; you use its *Report format* for the reconciled report.

## Steps

1. **Fix the diff.** Resolve the base and head SHAs once and create a new run directory outside the repository, e.g. `/tmp/pr-spec-audit-<number>/`. Done when both SHAs and the directory are recorded.
2. **Dispatch two subagents in parallel.** Give each the same brief: the PR, both SHAs, the absolute path to `AUDIT.md` with the instruction to follow it, and its own output path (`<dir>/run-a.md`, `<dir>/run-b.md`). Keep them blind: neither brief mentions the other run. Done when both report files exist.
3. **Reconcile.** Read `AUDIT.md` and both reports, then match findings that describe the same defect at the same code location, regardless of ID or wording. Apply the rules below, checking the cited code, spec, and test lines yourself wherever the runs disagree. Done when every finding from both runs is kept, merged, or dropped with a reason.
4. **Write the reconciled report** to the path the user gives, otherwise `<dir>/reconciled.md`. Done when every kept finding has its `###` section or *Low test gaps* entry and every dropped finding appears in *Dropped*.

## Reconciliation rules

- **Both runs report it**: keep one finding with the sharper *Finding* and *Proposal*. *Found by*: `both`.
- **One run reports it, the other confirms the category**: verify the cited lines. Keep it when the defect is real (*Found by*: `one run, verified`); otherwise drop it with the reason.
- **Status or risk differs**: re-derive it from the cited source and test lines. A genuinely ambiguous source makes it `PENDING_USER`. Risk takes the higher value unless verification rules it out.
- **One finding bundles defects of different risk**: split it into one finding per defect, each with its own risk.
- **A category is *Confirmed*** only when no kept finding in that file falls in it and at least one run confirmed it. The line lists category names only.
- **IDs** are reassigned so they count up without gaps across the reconciled report.

## Reconciled report

The `AUDIT.md` report format, with these additions:

- Header line after `sources`: ``runs `<dir>/run-a.md` · `<dir>/run-b.md` ``.
- Each `###` finding adds a field after *Risk*: `- **Found by**: both` or `- **Found by**: one run, verified`.
- Each *Low test gaps* entry ends with `(both)` or `(one run)`.
- A final line: `Dropped: <run>:<old ID> <short behavior> — <reason>; …`, or `Dropped: none`.

The final reply is the reconciled report link, the two count lines, and how many kept findings each run missed.
