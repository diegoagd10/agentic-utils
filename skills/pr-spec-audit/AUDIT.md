# PR spec audit: one run

One audit run of a PR against its spec. The `pr-spec-audit` orchestrator dispatches two independent runs from this file; your brief gives the PR, the base and head SHAs, and your output path. The product is a **decision list**: for every production file the PR changes, each finding with its ID, category, status, risk, proposal, and the decision the user must make. The audit is read-only: production code, tests, and the user's checkout stay untouched.

## Steps

1. **Fix the diff.** Audit exactly the base and head SHAs from your brief.
2. **Gather product sources**: PR description, linked tickets/specs, ADRs, domain docs, repo instructions. Only these state intent; tests and implementation are evidence to check against them.
3. **Audit each production file** (human-authored, non-test, non-generated) through all five categories. For each behavior the file changes, check it against the product sources and the tests that exercise it, and assign one status. Before calling a category *Confirmed*, enumerate in your working notes every changed behavior it covers, each paired with the source line and the test assertion that settle it; any behavior left unpaired becomes a finding. The enumeration stays in your notes; the report carries only the category name. Done when every production file has, for each of the five categories, findings, an enumeration backing *Confirmed*, or a reason the category does not apply.
4. **Write the report** in the format below. Done when every finding outside a *Low test gaps* line has its `###` heading and all six fields, one sentence each.

## Reference

**Categories** — the five risk types audited in every file:

| ID prefix | Category | Checks |
|-----------|----------|--------|
| `B` | BOUNDARY | Limit values: min, max, overflow, max length, request body size. |
| `N` | NULL/EMPTY | Null, empty, and whitespace-only input. |
| `A` | AUTHORIZATION | Role × endpoint matrix: 401/403 versus 200. |
| `I` | INJECTION | SQL/NoSQL, XSS, command, and path-traversal payloads. |
| `S` | STATE | Lifecycle, idempotency, retries, replay, and effects of edit/delete on later requests. |

**IDs** go only to findings that need action (every status except `CONFIRMED`): the prefix plus a number counting up across the whole report, `B-1`, `B-2`, `N-1`, `A-1`.

**Status** — exactly one per finding:

- `CONFIRMED`: a source specifies the behavior and a test asserts it.
- `PENDING_USER`: sources are silent, ambiguous, or conflicting, and the code made a choice.
- `CONTRADICTION`: code or a test conflicts with a source.
- `NO_EVIDENCE`: a source specifies the behavior and no test asserts it.

**Risk**: `High` / `Medium` / `Low` by impact and likelihood if the behavior is wrong.

**Test evidence**: a test counts only when its assertion would fail on a plausible defect. A test that mirrors the implementation, mocks away the claimed path, or restates a constant counts as no evidence, and the finding says so in *Finding*.

## Report format

Write to the output path in your brief. Write the report in English, whatever language the user or the sources use. The report contains exactly this:

```markdown
# PR audit <number>: <title>
base `<sha>` · head `<sha>` · <date>
sources `<spec root>`
BOUNDARY <n> · NULL/EMPTY <n> · AUTHORIZATION <n> · INJECTION <n> · STATE <n>
PENDING_USER <n> · CONTRADICTION <n> · NO_EVIDENCE <n>

## `<path/to/file>`

### A-1 - Read-only users can delete drafts

- **Category**: AUTHORIZATION
- **Status**: PENDING_USER
- **Risk**: High
- **Finding**: `file.ts:42` lets read-only users delete drafts; the spec does not cover it.
- **Proposal**: Reject with 403.
- **Decision**: Can read-only users delete drafts?

Low test gaps: `B-2` 0.001 servings never asserted (`tests/log.test.ts:520`); `N-1` unknown-nutrient warning text unchecked (`tests/mcp.test.ts:154`)
Confirmed: BOUNDARY, NULL/EMPTY
Not applicable: INJECTION — the file takes no external input.
```

- One `##` section per production file, in diff order; one `###` per finding, titled `<ID> - <short behavior>`. *Confirmed* lists only the names of the categories the file passes with every behavior `CONFIRMED`, e.g. `Confirmed: AUTHORIZATION, STATE`; those behaviors get no ID, no section, and no justification.
- *Low test gaps* holds every `NO_EVIDENCE` finding with `Low` risk, one short clause and one citation each, instead of a `###` section. These keep their IDs and count in both count lines.
- Both count lines count only findings that need action.
- *Not applicable* lists each category with no findings in that file, with its reason.
- *Finding* cites `file:line` for the code and `file:line` for the spec or test involved, never the source by name alone. Code and test paths are relative to the repository root; spec paths are relative to the `sources` root, e.g. `spec.md:89`, `issues/02-search.md:26`. Omit the `sources` line when every source lives in the repository.
- *Proposal* is the concrete change the auditor recommends.
- *Decision* is the one question the user answers: the product question for `PENDING_USER`, "Apply proposal?" otherwise.
- Files the audit could not examine go in one final line: `Not reviewed: <path> — <reason>`.

Your final reply is the report path plus the two count lines.
