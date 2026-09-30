---
name: pr-contract-audit
description: Audit every production file in a PR for boundary, null/empty, authorization-matrix, and injection risks, producing a terse Markdown decision list.
disable-model-invocation: true
---

# PR contract audit

The product is a **decision list**: for every production file the PR changes, each finding with its ID, category, status, risk, proposal, and the decision the user must make. The audit is read-only: production code, tests, and the user's checkout stay untouched.

## Steps

1. **Fix the diff.** Resolve the base and head SHAs and audit that exact diff. Done when both SHAs are recorded.
2. **Gather product sources**: PR description, linked tickets/specs, ADRs, domain docs, repo instructions. Only these state intent; tests and implementation are evidence to check against them.
3. **Audit each production file** (human-authored, non-test, non-generated) through all four categories. For each behavior the file changes, check it against the product sources and the tests that exercise it, and assign one status. Done when every production file has, for each of the four categories, findings or a reason the category does not apply.
4. **Write the report** in the format below. Done when every finding has its `###` heading and all six fields, one sentence each.

## Reference

**Categories** — the four risk types audited in every file:

| ID prefix | Category | Checks |
|-----------|----------|--------|
| `B` | BOUNDARY | Limit values: min, max, overflow, max length. |
| `N` | NULL/EMPTY | Null, empty, and whitespace-only input. |
| `A` | AUTHORIZATION | Role × endpoint matrix: 401/403 versus 200. |
| `I` | INJECTION | SQL/NoSQL, XSS, command, and path-traversal payloads. |

**IDs** go only to findings that need action (every status except `CONFIRMED`): the prefix plus a number counting up across the whole report, `B-1`, `B-2`, `N-1`, `A-1`.

**Status** — exactly one per finding:

- `CONFIRMED`: a source specifies the behavior and a test asserts it.
- `PENDING_USER`: sources are silent, ambiguous, or conflicting, and the code made a choice.
- `CONTRADICTION`: code or a test conflicts with a source.
- `NO_EVIDENCE`: a source specifies the behavior and no test asserts it.

**Risk**: `High` / `Medium` / `Low` by impact and likelihood if the behavior is wrong.

**Test evidence**: a test counts only when its assertion would fail on a plausible defect. A test that mirrors the implementation, mocks away the claimed path, or restates a constant counts as no evidence, and the finding says so in *Finding*.

## Report format

Write to the path the user gives; otherwise to a clearly named file outside the repository. Write the report in English, whatever language the user or the sources use. The report contains exactly this:

```markdown
# PR audit <number>: <title>
base `<sha>` · head `<sha>` · <date>
BOUNDARY <n> · NULL/EMPTY <n> · AUTHORIZATION <n> · INJECTION <n>
PENDING_USER <n> · CONTRADICTION <n> · NO_EVIDENCE <n>

## `<path/to/file>`

### A-1 - Read-only users can delete drafts

- **Category**: AUTHORIZATION
- **Status**: PENDING_USER
- **Risk**: High
- **Finding**: `file.ts:42` lets read-only users delete drafts; the spec does not cover it.
- **Proposal**: Reject with 403.
- **Decision**: Can read-only users delete drafts?

Confirmed: BOUNDARY, NULL/EMPTY
Not applicable: INJECTION — the file takes no external input.
```

- One `##` section per production file, in diff order; one `###` per finding, titled `<ID> - <short behavior>`. *Confirmed* lists each category the file passes with every behavior `CONFIRMED`; those behaviors get no ID and no section.
- Both count lines count only findings that need action.
- *Not applicable* lists each category with no findings in that file, with its reason.
- *Finding* cites `file:line` and the source or test involved.
- *Proposal* is the concrete change the auditor recommends.
- *Decision* is the one question the user answers: the product question for `PENDING_USER`, "Apply proposal?" otherwise.
- Files the audit could not examine go in one final line: `Not reviewed: <path> — <reason>`.

The final reply is the report link plus the two count lines.
