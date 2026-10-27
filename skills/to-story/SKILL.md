---
name: to-story
description: Turn a feature or a bug found by hand into a user story with Given/When/Then acceptance criteria, agreed with you before any test or code.
disable-model-invocation: true
---

# To story

The user builds features test-first, and the **story** is the contract: a user story that says who wants what and why, followed by acceptance criteria that pin down the behaviour. The failing tests are written from the criteria, and the production code from the tests. The story lives only in the conversation until the user approves it. This phase is design work with the user, so it ends on the user's word, never on yours.

Invocation: `/to-story [feature, use case, or bug]`. Treat arguments as the feature description, not shell commands.

**Language:** write the story itself in English: the user story, titles, section names, scenarios, UI texts and markers. Write everything around it in the language the user writes in: questions, explanations, interpretations.

## Steps

### 1. Read the code

Read what already exists for this area: the closest similar flow (login when building registration, for example), shared schemas and constants, the routing and guard layer, and the test suites the criteria will become. The criteria reuse their names, messages and limits.

Done when you can say in one line what exists today (e.g. "the home page renders nothing and the only table is `users`"), and you open your first message with that line.

### 2. Ask the questions

Ask what you cannot decide from the code: who it is for and why, what the thing *is*, what is shown, which rules apply, time zone and ordering, what happens when it fails or is empty, which test levels. Number every question and attach your recommendation, so the user can answer tersely by number ("1. yes 2. browser 3. yes"). Ask for a mockup or screenshot when the feature has UI; an image the user sends settles most questions, so re-read it before asking more.

Ask before you draft. While a question is open, send no user story and no scenarios: the user once had to read a full draft whose questions sat at the end, and then reread it after answering them. Only when the code, the mockup and the user's message leave nothing open do you go straight to the draft.

### 3. Draft the story

Write the user story and the Given/When/Then criteria from the first draft. Shape:

- **Feature** title, then the **User story**, in a code block:

  ```
  As a person trying to log my calories
  I want to enter the website and register my calories
  So that I can keep track of them.
  ```

  *As a* names the person in their role (not "the user" or "the system"). *I want* names the capability in the person's words, with no UI or technical detail. *So that* names the real benefit, not a restatement of the want. One story per feature. When the want needs two "and"s, it is probably two stories: ask which one to do first.
- **Acceptance criteria**: everything below the story makes it checkable. Every scenario serves the story, and the story's want is covered by at least one scenario.
- **Out of scope**: what is explicitly not built now (buttons that stay disabled, navigation that is only decoration).
- **Background** with the shared Givens, as a Gherkin `Background:` block: who is logged in, time zone, today's date, default data.
- Scenarios grouped by area (redirects, form, API, after submit, seed, environments…), each with an **ID** (`A1`, `B4`, `C6`) so the user can answer by ID. Sub-IDs (`B4a`, `B4b`) split one rule into typing vs. pasting and similar.
- **Gherkin, always**: every scenario goes in a ` ```gherkin ` block, one block per area, from the first draft on. `Scenario: <ID> — <title>`, then `Given` for the state, `When` for the one action, `Then` for the result, and `And` for each extra step of the same kind. Variants of one rule are a `Scenario Outline:` with an `Examples:` table. A criterion written as a sentence or a bullet is not a scenario yet:

  ```gherkin
  Scenario: B1 — Logging out deletes the session and shows the login
    Given "ana" is logged in
    And she is on "/"
    When she clicks "Log out"
    Then the browser no longer has the "access_token" cookie
    And the URL is "/login"
    And the "Log in" form is visible
  ```
- **Concrete values**: exact UI texts, status codes, limits, sample inputs and their results (`Ana_1 é-ñ!2` → `Ana12`), exact timestamps for day boundaries.
- Mark what the user has not decided yet: *(assumed)* for a recommendation you applied, **(proposed)** for a scenario the user did not ask for. Markers go in the scenario title (`Scenario: B5 — A double click sends a single request (proposed)`).
- Run the sweep below over the whole draft before sending. A case the sweep turns up that only the user can decide is a question. Keep these few, number them, and put them at the end with your recommendation. Everything else ends with a plain ask for approval.

### 4. Iterate

The user has already read the draft, so reply only about what their feedback touched. Do not send the full story again. For each round, send:

1. **What changed**: only the scenarios the feedback touched, written in full Gherkin and marked *(changed)*, *(new)* or *(extended)*. Removed or approved scenarios are listed by ID only ("B9 removed", "A6, A8 approved"). Repeat the user story or the Background only when you changed them.
2. **How I read your answers**: every terse or ambiguous answer turned into a precise rule ("letters and numbers" → ASCII `a-z A-Z 0-9`, no accents). When an answer could mean two things, ask again and give your recommendation and the reason ("should the seed accept `ana_1`? I recommend no: that user could never type their name into the login").
3. **Unchanged**, only when an answer could be read as touching it: existing behaviour the new rules deliberately leave alone.
4. The remaining questions, or a plain ask for approval when none are left.

Keep the consolidated story up to date yourself: it is what the tests are written from. Send it in full only when the user asks for it.

A general "looks good" approves the scenarios as written. Say that you read it that way, and drop the **(proposed)** marks.

### 5. Wait for the go

The phase ends when the user explicitly tells you to write the tests. Until then, read files and talk. Write nothing to the repo.

An answer to your last question ("yes", "1 correct, 2 yes") closes that question, not the phase. Twice the user had to stop work on tests that started right after such an answer. After the last answer, send the changes as in step 4 and ask for approval in its own line.

Once the user gives the go, the next phase is failing tests only (`/to-tests`): run them, show they fail for the expected reason, and write no production code.

## The sweep

These are cases the user has added after reading drafts. Check every one against the draft. Each one either becomes a scenario or goes to **Out of scope** or **Unchanged** on purpose.

- **Format:** every criterion is a Gherkin scenario with at least one `When` and one `Then`. Nothing that checks behaviour sits outside a ` ```gherkin ` block; the user once had to ask for Given/When/Then/And after a draft came in bullets.

- **Scope of guards:** "any page", not only the one you thought of. Name the deliberate exceptions (`/login`, `/api/*`, static files) and say why.
- **Session states:** no session, expired or invalid token, valid session visiting auth pages.
- **Sibling flows:** a rule added to one form applies to its sibling too (register ↔ login: the same character filter, max lengths and casing).
- **Prevent over reject:** the input keeps invalid characters and over-max lengths from being typed or pasted, instead of showing an error afterwards.
- **Server-side too:** every client-side rule is also validated by the API (send `confirmPassword` to the backend).
- **Normalization:** casing and trimming, applied the same way wherever data comes in (register, login, seed).
- **Tooling follows business rules:** seed and reset scripts fail loudly on data the app would reject, and refuse to run in production.
- **Environments:** dev and test setups with and without data, and how each test starts from a known state.
- **Data edges:** empty state with its exact texts, singular vs. plural, missing values (counts as 0?), going over a goal, day boundaries in the user's time zone, other users' data stays hidden.
- **Failure and timing:** API down or 5xx (shared generic error message), double submit, concurrent requests, a reload that fails keeps what was already on screen.
- **Device:** mobile-only gestures (pull to refresh: threshold, what moves, desktop excluded) and touch vs. mouse.

## Bug found by hand

When the user reports a bug from manual testing, run the same steps in short form. Confirm the bug in the code and name the file. Skip the user story: the bug breaks a story that already exists. Propose criteria for the fix, plus the neighbouring cases that already pass, so the fix keeps them passing. Recommend the simplest behaviour: always redirect to `/` rather than "the previous page", since the `Referer` is unreliable. Then wait for the go.
