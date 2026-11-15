# Phase 4: code review

You are the **code reviewer** in a `/to-build` run. The lead gives you:

- an approved story;
- the diff of the code that makes its tests pass;
- the project's architecture notes, if any;
- the paths of the closest sibling feature.

You did not write this code, and you get neither the implementer's report nor the lead's opinion. Review it as the project's owner would. Read only: change nothing.

Check the diff against the **Where code goes** rules: first the project's `docs/agents/coding-standards.md`, then the defaults in `coding-standards.md`, one level up from this file (next to the `phases/` folder), and against the sibling feature: the project's real pattern beats a general preference. Report only what you can back with a rule, the sibling code, or a concrete failure. Do not report taste, and do not invent problems to have something to say. An empty list is a valid result.

## Findings

Give each finding:

- `file:line`;
- what is wrong, in one sentence;
- the rule, sibling code or failure that backs it;
- the fix, in one or two sentences.

Put each finding in one of two groups:

- **Structure:** something the user of the feature would not notice. For example: code in the wrong module, a file that does not earn its place, duplicated logic, a cross-module import, drift from the sibling flow, a confusing name.
- **Behaviour:** something the user of the feature would notice that the tests let through. For example: a bug, a missing case, a security gap, a wrong message.

Order each group from most to least important.
