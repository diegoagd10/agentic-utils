---
name: pr-contract-audit-reconcile
description: Run two independent pr-contract-audit subagents on one PR, then reconcile their reports into a single verified decision list.
disable-model-invocation: true
---

# PR contract audit, reconciled

Two audits of the same diff disagree on which findings they surface. This skill runs two **independent** audits and **reconciles** them into one report, so a finding survives on evidence, not on which run happened to see it. The whole flow is read-only: production code, tests, and the user's checkout stay untouched.

The audit itself is defined by the sibling skill `pr-contract-audit` (`../pr-contract-audit/SKILL.md` from this skill's directory). Its categories, statuses, IDs, citations, and report format all apply here unchanged.

## Steps

1. **Fix the diff.** Resolve the base and head SHAs once. Done when both SHAs are recorded; both subagents audit exactly this diff.
2. **Dispatch two subagents in parallel.** Give each the same brief: the PR, both SHAs, the path to `pr-contract-audit/SKILL.md` with the instruction to follow it, and its own output path (`<dir>/run-a.md`, `<dir>/run-b.md`). Keep them blind to each other: neither brief mentions the other run. Done when both report files exist.
3. **Reconcile.** Read both reports, then match findings that describe the same defect at the same code location, regardless of their IDs or wording. Resolve each case with the rules below, checking the cited code, spec, and test lines yourself whenever the runs disagree. Done when every finding from both runs is kept, merged, or dropped with a reason.
4. **Write the reconciled report** in the format below. Done when every kept finding has its `###` heading or *Low test gaps* entry, and every dropped finding appears in *Dropped*.

## Reconciliation rules

- **Both runs report it**: keep one finding, with the sharper *Finding* and *Proposal*. *Found by*: `both`.
- **One run reports it, the other confirms the category**: verify the cited lines. Keep it when the defect is real (*Found by*: `one run, verified`); otherwise drop it with the reason.
- **Status or risk differs**: re-derive it from the cited source and test lines. When the source is genuinely ambiguous, the status is `PENDING_USER`. Risk takes the higher value unless verification rules it out.
- **A category is *Confirmed*** only when no kept finding in that file falls in it and at least one run confirmed it.
- **IDs** are reassigned so they count up without gaps across the reconciled report.

## Report format

Write to the path the user gives; otherwise next to the two run reports as `<dir>/reconciled.md`. Use the `pr-contract-audit` report format with these changes:

- Header adds a line: `runs `<dir>/run-a.md` · `<dir>/run-b.md``.
- Each `###` finding adds a seventh field after *Risk*: `- **Found by**: both` or `- **Found by**: one run, verified`.
- *Low test gaps* entries end with `(both)` or `(one run)`.
- One final line lists findings dropped during reconciliation: `Dropped: <run>:<old ID> <short behavior> — <reason>; …`, or `Dropped: none`.

The final reply is the reconciled report link, the two count lines, and how many kept findings each run missed.
