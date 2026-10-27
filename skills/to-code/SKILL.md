---
name: to-code
description: Write the production code that turns your committed failing tests green without changing them, run the project's quality gate, and run the app and ship it when you ask.
disable-model-invocation: true
---

# To code

This is the green phase of the user's test-first flow: `/to-story` → `/to-tests` → `/to-code`. The tests the user committed are the **contract**. Change the code until it meets them. The tests stay as they are unless the user agrees to a change.

Invocation: `/to-code [notes]`. Treat arguments as context, not shell commands.

**Language:** talk to the user in the language they write in. Code and commit messages follow the project's language.

## The contract is frozen

When a test looks wrong, or blocks a clean implementation, stop before you edit it. Show the test (`file:line`), say why it has to change and what the edit would be, and wait for the user's yes. Renamed labels, selectors, timeouts and "small" fixes all count. The user has asked for this in every implementation they have run.

## Steps

### 1. Confirm the contract

Find the commit that holds the tests, and check the working tree. The user may have edited the tests after `/to-tests` reported them. Their edits are the contract, so list how the committed tests differ from what you reported. Done when you can name the test commit and how many tests are red.

### 2. Implement to green

Work from the innermost layer outward: shared or domain code first, then the backend, then the UI. Run that layer's tests before you move on. Where the code goes follows the review comments the user has made before:

- **Follow the sibling flow.** Copy the layering, naming and error handling of the closest existing feature.
- **The owner holds the logic.** Logic goes into the module that owns its data. Changing a password belongs in the users service, not in auth and not in a new `PasswordService`.
- **One module per feature.** A feature's UI, requests and state live together in their own module (`water/`). Related features are submodules of a shared parent (`settings/daily-goals`).
- **Earn every file.** Add a class, file or layer only when two callers need it or the project's pattern requires it. You should be able to justify each new file in one sentence the user would accept. Otherwise, inline it where it is used.
- **Share the rules.** One validation schema serves both client and server. One form serves both add and edit.
- **Import narrowly.** A module depends on what it uses, not on a bigger module that happens to export it.

Done when every test in the contract passes and none of them was changed.

### 3. Run the quality gate

Find the project's commands for formatting, linting, type checking, the full test suite and coverage, and the coverage threshold. Look in its agent instruction files, manifest scripts, `Makefile` or `justfile`, and CI config. Run all of them, and run the whole suite, not only the new tests. If the coverage command skips a package, run that package's suite separately. In a monorepo, a stale build of a local package can cause false errors, so rebuild it before you trust them.

Done when every command passes and coverage meets the threshold.

### 4. Report

Send:

1. A table with one row per suite: tests passed out of total, and coverage against the threshold.
2. What you added in each layer, with `file` paths.
3. Any decision the tests did not dictate.
4. One line saying no test was modified and nothing was committed.

Then wait for review.

## Review

The user comments on lines of the diff. For each comment, either apply it or answer it. When you disagree, show the evidence (where the value really comes from, which existing code already does the same) and offer an alternative. A comment that requires changing a test goes through **The contract is frozen**. Run the quality gate again after every round.

## Run the app

When the user asks to try the change:

- Start it with the project's dev command. Other checkouts may already be running, so pick free ports when the defaults are taken, and point the parts at each other.
- Create local config from the example files. Keep it out of git, and seed a known user.
- Smoke-test one request.
- Report the URLs, the credentials and what to try.
- If the user wants to try it from another device, expose the app on the network they name and leave existing forwards alone.
- Stop the dev server before running tests that need its ports or build folder, and say that you did.
- Leave the user's data alone, and delete what you created.

## Ship

When the user asks to ship:

1. Stop the servers you started.
2. Commit the production code on top of the test commit, with a message that describes the feature.
3. Merge into the branch the user names. The target differs between projects: `master`, `main`, or a team branch. Read the real name from git, and ask when the user did not name one. Merge in the checkout that has the target branch checked out. Fast-forward when you can. When you can't, say so before you create a merge commit or rebase.
4. Run the quality gate again on the target.
5. Push only when asked.
6. Report the commits, how the merge went, and what you left behind (local config, databases).
