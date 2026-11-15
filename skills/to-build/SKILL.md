---
name: to-build
description: Take an approved story through failing tests, an independent test check, green code, a code review and a refactor on its own, with evidence for every step, and hand you a flow diagram of what was built to review.
disable-model-invocation: true
---

# To build

The user's flow is `/to-story` → `/to-build` → review. The user decides twice: the **story** (what gets built) and the **review** at the end (how it was built). Between those two points this skill works on its own: every phase ends on a check that passes or fails, so the user is never asked something a command can answer.

This skill stands alone. It shares no files with the step-by-step skills, so the two flows can be compared.

Invocation: `/to-build [story or notes]`. Treat arguments as context, not shell commands. Without arguments, use the story approved last in this conversation. If none was approved, stop and suggest `/to-story`.

**Language:** talk to the user in the language they write in. Tests, code and commit messages follow the project's language.

## Roles

You are the **lead**. You plan, start each phase, and check its result yourself. **Subagents** do the work inside a phase, so your own context stays small enough to judge the whole run. A subagent's report is a claim, not a result: before you call a phase done, run its check yourself and read the output.

Start a subagent only for:

- the work of a phase, which runs in its own context;
- a check that needs fresh eyes: a subagent that did not write what it checks.

Every subagent re-reads the code and costs tokens. Look things up yourself when a few tool calls will do, and run the phases one after another, since each one builds on the last.

Start each subagent with this model and effort (in Claude Code, the Agent tool's `model` and `effort`):

| Role | Model | Effort | Why |
| --- | --- | --- | --- |
| Tests writer | `opus` | medium | A story is a small deliverable; Opus on medium handles it |
| Test verifier | `sonnet` | medium | It compares two texts, scenario by scenario |
| Code reviewer | `fable` | high | A strict reviewer that does not just agree; it only reads, so its cost stays bounded |
| Implementer, refactorer | `opus` | medium | Same as the tests writer |
| Broad file searches, reading long logs | `haiku` | low | Lookup work |

When the model a role names is not available, use the closest one and say so in the report.

The lead is the session the user runs `/to-build` in. Recommend `/model` Opus and `/effort high` for it, once at the start if the session differs. The lead chains five phases nobody watches, and lower effort stops early more often. It writes no code itself, so high costs little here. Medium also works with **Keep going** below. If runs on medium end with a list of what is left, move the lead to high. Do not go above high: it costs much more for little gain.

Every brief to a subagent contains:

- the approved story in full;
- the phase goal and its done check;
- the phase file for its role and, for the implementer, reviewer and refactorer, `coding-standards.md`, as **absolute paths** inside this skill's directory (the files are listed below), plus the path of the project's own `docs/agents/coding-standards.md`;
- what it must not do;
- the report you expect back.

Leave out your guess about the answer, so the subagent checks the work instead of agreeing with you.

This skill's directory holds:

| File | Who reads it |
| --- | --- |
| `phases/tests.md` | Tests writer |
| `phases/verify.md` | Test verifier |
| `phases/implement.md` | Implementer |
| `phases/review.md` | Code reviewer |
| `phases/refactor.md` | Refactorer |
| `coding-standards.md` | Default **Where code goes** and **Definition of done**: you, implementer, code reviewer, refactorer |
| `run-and-ship.md` | You, for screenshots, trying the app and shipping |

## Keep going

Run all the phases in one go. When a phase's check passes, start the next one. Do not stop to offer the next phase or to list what is left.

Stop only for:

- **a decision that belongs to the user:** a test that has to change, a scenario that turns out contradictory or impossible, a missing credential or service, uncommitted changes of the user's in the working tree;
- **an action that cannot be undone:** pushing, merging into the base branch, deleting the user's data.

Local commits and amends on the feature branch can be undone, so make them without asking.

When you stop, say exactly what you need and what you will do with each possible answer. When the user approves something, note exactly what they approved, so you do not ask the same kind of question again later in the run.

When a phase's check fails, send it back to its subagent with the failing output. After three failed rounds of the same phase, stop and report what blocks it.

## Evidence

Keep an evidence folder outside the repository: `~/.tickets/<project>/<feature-slug>/evidence/` when `~/.tickets/<project>/` exists, otherwise a `<feature-slug>/evidence/` folder in your scratchpad or temp directory.

For every check, save one file with the command, its exit code and its **full** output. That includes git checks such as the list of changed files. The report quotes only the relevant lines; the files keep the rest. A check reported as passed without its saved file does not count.

## The contract check

Phases 3, 5 and 6 all run this check against `<contract-sha>`. That is the tests commit, and it moves only when the user approves a test change.

1. `git diff --name-only <contract-sha>` plus untracked files (`git status --porcelain`) lists no test file, fixture, test helper, snapshot, test config or coverage config.
2. No `.skip`, `.only`, `xfail` or similar marker was added anywhere.
3. The full suite passes, except the baseline failures from phase 0, which must match the saved list exactly.
4. The **Definition of done** commands for categories 2 to 6 pass: coverage, formatting, lint, types and dependencies.

## Phases

### 0. Set up

1. Read the story, the project's agent instruction files, `coding-standards.md` in this skill's directory, and the project's `docs/agents/coding-standards.md`.
2. If the working tree has uncommitted changes, stop: they belong to the user.
3. The base branch is the default branch from `origin/HEAD`; with no remote, it is the branch checked out now. Fetch when there is a remote. Record the base, then create `feat/<feature-slug>` from it.
4. If the project has no coding standards file, or its **Definition of done** lacks a command for a category, draft the missing parts. Read them from the project itself: its manifest scripts, `Makefile` or `justfile`, CI config, and how existing features are built. Mark a category with no tool as `none`, and write no rule the code does not show. Show the draft to the user and stop: approving it is their decision. This happens once per project. After approval, commit the file on its own as the first commit of the feature branch (`docs: add coding standards`). It reaches the base branch with the feature, and every later run finds it.
5. Run the **Definition of done** commands for categories 1 to 6 once, as the baseline.

Done when you can name the branch, the base commit and the command for each category, and the baseline is saved. The baseline is green, or it lists exactly what already fails on the base (tests, vulnerabilities): those are not this run's to fix.

### 1. Failing tests: tests writer

Brief: `phases/tests.md`.

Check it yourself:

- every new test fails for the reason the report gives (read the failure lines), or the report lists it as a guard and names the existing behaviour that makes it pass;
- every existing test still passes. In a compiled project where the suite cannot build without the missing code, run the existing suites with the new test files excluded, and say so;
- stage everything and run `git diff --cached --name-only`: only tests, fixtures and test helpers.

Commit only the tests: `test: add failing tests for <feature>`. This commit is the first `<contract-sha>`. Record how many new tests there are and how many are red.

Done when the tests commit exists and its checks are saved.

### 2. Tests match the story: test verifier

Start a fresh subagent with `phases/verify.md`. Give it only the approved story and the tests commit (`git show <contract-sha>`), not the writer's report.

Done when its verdict is **pass**:

- every scenario maps to exactly one test (a `Scenario Outline` maps to one parametrized test);
- every test maps to a scenario;
- no test checks less than its scenario.

Otherwise, send the table to the tests writer and amend the tests commit, which no production code depends on yet. After each amend, rerun the phase 1 checks and start a new fresh verifier on the new `<contract-sha>`. Save the final table: it goes into the report.

### 3. Green: implementer

Brief: `phases/implement.md`, plus `<contract-sha>` and the project's commands from phase 0.

Run **the contract check** yourself.

A test that has to change is a decision that belongs to the user: stop and ask. If they approve, the tests writer makes exactly that change in a new `test:` commit. Phase 2 runs again for the scenarios it touches, and `<contract-sha>` moves to that commit.

Commit the production code on top of the tests: `feat: <feature>`.

Done when that commit exists and its contract check is saved.

### 4. Code review: code reviewer

Start a fresh subagent with `phases/review.md`, and give it:

- the story;
- the green diff (`git diff <contract-sha>..HEAD`);
- the project's architecture notes, if any;
- the paths of the closest sibling feature.

Leave out the implementer's report and your own view of the code. It returns **structure** and **behaviour** findings.

Save the findings. Structure findings go to phase 5. Behaviour findings mean the story or the tests miss a case. They are the user's decision, so list them in the report and do not fix them in this run.

Done when the findings are saved, or the reviewer reports none.

### 5. Refactor: refactorer

Start a fresh subagent with `phases/refactor.md`. Give it the same material as the reviewer, plus the structure findings from phase 4. It applies them without changing behaviour or touching tests.

Run **the contract check** yourself.

Commit: `refactor: <feature>`. When there is nothing to change, say so and make no commit.

Done when the refactor is committed, or reported as not needed, and its contract check is saved.

### 6. Report and review

First collect the demo evidence for **Definition of done** categories 7 and 8, following `run-and-ship.md`. Look at every screenshot yourself against the story's texts and the mockup. Any mismatch is a behaviour finding for the user.

Write the report as one self-contained HTML page in the evidence folder and show it to the user (render or open it). In the chat, give three to five lines and the path. Write it for someone who did not watch the run: the most important thing first, in plain words, with no jargon the story did not use.

In this order:

1. **Verdict** in one line: done, or what blocks it.
2. **How a request flows**: one use of the feature traced end to end through the project's own layers (in a web app, for example: UI → browser request → route → client → controller → service → data). Draw it as a diagram (inline SVG or Mermaid), with `file` paths and the new pieces highlighted.
3. **What depends on what**: the touched modules, entry points (controllers, commands, handlers) on the left and what they call on the right, new pieces highlighted. Each new file, module or service gets one line on why no existing one could hold it.
4. **Decisions the tests did not dictate**, each with the alternative that was rejected.
5. **Code review**: the reviewer's structure findings and what the refactor did with each, then its behaviour findings for the user to decide on (amend the story or drop).
6. **Scenario → test** table from phase 2, plus any tests the writer proposed without a scenario, for the user to accept or drop.
7. **Definition of done**: one row per category with its command, result and the relevant lines, linking to its evidence file. Categories marked `none` are named here. Then the screenshots and the `curl` requests and responses, each under its scenario ID.
8. **Commits**: tests, feat and refactor with their SHAs, so the user can review each diff on its own.
9. **Left behind**: local config or databases created, servers stopped.

Then wait for the user's review. Each change they ask for takes one of two paths:

- **Structure** (where code lives, names, splitting or merging pieces): the refactorer makes it, then run **the contract check** and commit `refactor: apply review on <topic>`.
- **Behaviour** (anything a user of the feature would notice): it changes the story first. Amend the scenario with the user. Then the tests writer adds or changes tests in a new `test:` commit, phase 2 checks the touched scenarios, `<contract-sha>` moves to that commit, and the implementer commits `feat:` or `fix:`.

After each round, update only the parts of the report that changed.

Merging and pushing happen only when the user asks. Follow **Ship** in `run-and-ship.md`.
