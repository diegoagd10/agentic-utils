---
name: to-tests
description: Turn an approved story's Given/When/Then scenarios into failing tests, run them red for the expected reason, and stop for your review before any production code.
disable-model-invocation: true
---

# To tests

This is the red phase of the user's test-first flow: `/to-story` → `/to-tests` → `/to-code`. The approved story is the spec. Every scenario becomes a test, every test fails because the feature is missing, and no production code exists yet. The user reviews the tests and commits them. From then on they are the contract that `/to-code` implements against.

Invocation: `/to-tests [story, scenario IDs, or notes]`. Treat arguments as context, not shell commands. Without arguments, use the story approved last in this conversation. If none was approved, ask for it or suggest `/to-story` first.

**Language:** talk to the user in the language they write in. Test names, code and commit messages follow the project's language.

## Steps

### 1. Map the scenarios

Learn how this project tests from what the project itself says. Read its agent instruction files, its build manifest and scripts (`package.json`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Cargo.toml`, `go.mod`, `Makefile`, `justfile`), and its CI config. These tell you the frameworks, the test levels and the commands. Then read the specs of the closest existing flow, and the shared fixtures, factories, helpers and fault-injection tools those specs use.

Done when you can say, for every scenario ID, which test level and file it goes into and which existing helpers it uses. Use the test levels the story agreed on.

### 2. Write the tests

- **One test per scenario.** The test name starts with the scenario ID (`B4a — pasting strips invalid characters`), so the results map back to the story. A `Scenario Outline` becomes one parametrized test over its `Examples`.
- **Traceable.** Every test traces to a scenario ID. If you think the story needs a test it has no scenario for (a migration, a button that must not appear, a notice another task will remove), ask the user. Each round of review only removes these tests.
- **Reuse.** Build on the project's fixtures and helpers. When a helper you need is private to another spec, move it to the shared place and have both specs use it. Put new tests next to the tests of their sibling flow.
- **No production code.** In a compiled or type-checked project, the suite may refuse to run until a missing symbol exists. Add the smallest stub that lets it run, watch the tests fail on behaviour, then remove the stub. If compiling is the only failure the language allows, say so in the report.

### 3. Run red

Run every new test, plus the existing suites that share files or helpers with them.

Done when every new test fails **for the expected reason**: the route answers 404, the function does not exist, the element is missing, the value is wrong. A typo, a broken fixture, a wrong selector or a setup timeout is a bug in the test: fix it and run again. A new test that already passes is fine only when you can name the existing behaviour that makes it pass (for example, another user's entry already answers 404). Keep it as a guard and list it. Every existing test still passes.

### 4. Report and stop

Send:

1. A table with one row per suite: file, how many fail and how many pass, and why they fail.
2. The new tests that already pass, and why.
3. The helpers you moved or added.
4. One line saying that no production code was written and nothing was committed.

Then wait. The user reviews the tests and may comment on them. Apply each comment, run red again, and report only what changed. Commit only when the user asks. That commit holds only tests, and its message says so ("Add failing tests for …"). The phase ends when the user says they committed or tells you to implement. That is `/to-code`.
