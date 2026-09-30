---
name: pr-contract-audit
description: Audit the behavioral assumptions and test evidence in a pull request, producing an editable Markdown decision report.
disable-model-invocation: true
---

# PR contract audit

Use this skill when the user invokes `$pr-contract-audit` for a PR or a fixed Git diff. Its product is a **decision-ready Markdown report**, not code changes or a pass/fail verdict. The report lets the user correct assumptions before a later agent writes tests and changes production code.

## Inputs and boundaries

1. Resolve the exact base and head commits. Record both SHAs, the PR URL if given, and the report generation date. Review that fixed diff even if the branch moves later.
2. Read repository instructions, the PR description, relevant tickets/specs, domain docs, ADRs, and test commands. Treat these as potential sources of product intent. Cite their exact locations. Resolve conflicts explicitly; never promote a passing test or existing implementation into an authoritative requirement.
3. Read every changed human-authored production file and every added or changed test. Inventory generated files separately and verify their source and relevant contract. Map changed production behavior to tests, including behavior with no test and tests with no changed production counterpart. Keep a coverage ledger so every changed file is accounted for.
4. Analyze the diff without editing production code or tests. Read-only test runs and isolated probes are allowed when useful; label their results as observed and record the command. If a probe needs temporary changes, use a disposable checkout and verify the changes are discarded. Leave the user's checkout unchanged.

## Scenario audit

Use an **observable scenario** as the unit of review: an input or state, an action through a public seam, and an outcome. A scenario may span multiple classes or files. Cover the ordinary path and each relevant dimension below for every changed behavior. Mark a dimension `N/A` with a reason when it genuinely does not apply.

- Equivalence classes and boundaries: below, at, and above limits; zero; precision; result truncation.
- Missing, `null`, empty, malformed, and wrong-type inputs. Distinguish omitted from explicit values.
- Permissions, account isolation, missing/expired/revoked credentials, and effects after denial.
- Errors and response mapping across every changed interface.
- State transitions and lifecycle, including create/edit/delete/retry and persistence across restarts where relevant.
- Idempotency, replay, concurrency, and cross-channel separation.
- Dates, time zones, defaults, ordering, units, rounding, and data migration where relevant.
- Side effects and integration across UI, HTTP, MCP, service, and storage boundaries.

For **every added or changed test**, inspect its setup, oracle, assertions, and exercised seam. Record which scenario it supports. Ask where each expected value comes from: explicit product contract, independent calculation, fixture, or production implementation. Identify tests that only restate a constant or mirror the implementation, use a mock that bypasses the claimed path, lack a material assertion, or could pass despite a plausible behavioral defect. Mark these as weak or uncertain with the precise reason. A constant assertion is useful when the constant is itself an external contract. Use a targeted mutation or isolated probe only when it resolves a concrete uncertainty about test sensitivity.

Separate four kinds of evidence:

- **Specified:** explicit requirement, PR contract, ADR, or user decision.
- **Observed:** test result or isolated runtime probe, with command and environment.
- **Asserted:** what a test actually checks; a passing suite does not imply unasserted behavior.
- **Inferred:** code reading or a plausible hypothesis that was not executed.

For each scenario, compare the current behavior and test oracle with the strongest available product source. Assign exactly one status:

- `CONFIRMADO`: explicit product source supports the behavior and the test evidence is adequate.
- `PENDIENTE_USUARIO`: product source is silent or ambiguous, sources conflict, or a consequential behavior was assumed. Ask one concrete question and recommend a default with its tradeoff.
- `CONTRADICCION`: implementation or test expectation conflicts with an explicit product source. Quote both locations and propose the correction.
- `SIN_EVIDENCIA`: expected behavior is specified, but no adequate assertion or runtime evidence establishes it.

Do not ask the user to decide a behavior already settled by a cited requirement. Do not invent business intent to turn an ambiguity into `CONFIRMADO`. Risk level describes impact and likelihood; it does not determine whether a scenario appears in the report.

## Markdown report

Write a standalone `.md` file at the user-requested path. Otherwise put the draft **outside the repository** in a clearly named writable directory and link it in the final reply. The draft can later be copied into the repo after the user refines it. Match the user's language. Use one section per scenario, not one giant table. Give stable IDs derived from behavior (for example `AUTH-READ-ONLY`, `RETRY-AFTER-DELETE`), so edits and later test work can refer to them.

Use this structure:

```markdown
# PR contract audit: <title>

PR / base / head / date / evidence run
Scope and verification limits

## Review queue
Counts by status and risk; links to every PENDIENTE_USUARIO and CONTRADICCION.

## Scenario <ID>: <observable behavior>
**Status:** PENDIENTE_USUARIO
**Risk:** High | Medium | Low — one sentence explaining impact.
**Current behavior:** What code or runtime does today; label observed or inferred.
**Product source:** Requirement and location, or `Not specified`.
**Test evidence:** Exact test file, case, assertion, and what it does and does not prove.
**Dimensions:** Relevant boundary / missing-null-empty / permission / lifecycle / etc., each with covered, missing, or N/A.
**Assumption or discrepancy:** The specific choice being made by the implementation or test.
**Question for user:** One answerable product question; omit when status is CONFIRMADO or SIN_EVIDENCIA.
**Recommendation:** Proposed behavior and consequence; separate from the user's decision.
**User decision:** PENDING — leave this line intact for the user to edit.
**Acceptance scenario:** Given / when / then at the public seam. For pending items, mark `DRAFT — revise after decision`.
**Later test work:** Tests to add or adjust after approval; distinguish a correction expected to fail now from a regression test that may already pass.

## Test-quality findings
One item per weak or uncertain changed test, linked to its scenario and exact assertion.

## Change inventory
Every changed file, its role, scenario IDs, test mapping, and generated-file disposition.
```

Keep observations and user decisions in separate fields. Preserve an existing user's `User decision` text and accepted behavior on reruns; add a new observation or revision note instead of overwriting them. Never put an unapproved recommendation into an acceptance scenario as though it were decided.

## Completion check

Before delivering, verify that every changed human-authored file appears in the inventory, every changed test is mapped to at least one scenario or a test-quality finding, every relevant scenario dimension is covered or marked `N/A`, every pending product assumption has an explicit question and recommendation, and every claim has a source or is labeled inference. Report any unexamined files or unavailable verification prominently. The final reply links the Markdown draft and gives only the number of pending decisions, contradictions, evidence gaps, and weak tests; the document carries the details.
