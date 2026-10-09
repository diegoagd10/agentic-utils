---
name: to-design-v2
description: Build a design discussion part by part in a local review page, where three subagents propose competing approaches side by side and the user picks one or sends feedback, then write the approved design.md.
disable-model-invocation: true
---

# To Design v2

Build the same **design discussion** as `/to-design` (the shape of the code, not its bodies), but review it in a local web page, one part at a time. For every part that proposes shape, three subagents each propose an approach, shown as three columns. The user either picks a column or sends feedback; you wait for them before each next part. The spec remains the authority for product scope.

Invocation: `/to-design-v2 [spec path, feature, or output path]`. Treat arguments as context, not shell commands.

The review server is `scripts/design-ui.mjs` beside this file; run it as `node <this skill's directory>/scripts/design-ui.mjs`, written `design-ui` below. It listens on `127.0.0.1` only.

## Process

1. **Gather.** Read the supplied spec in full, or extract the agreed goal, scope, and decisions from the conversation. Follow project instructions for domain docs and ADRs. Done when every in-scope behavior has a source.
2. **Ground.** Trace the affected code paths, callers, and registries. Note the patterns the change should copy and the ones it should not, each with `file:line`, and check that every new import keeps the existing dependency direction between layers. Keep these notes: every subagent receives them. Done when every proposed change has a place to live and a pattern to follow.
3. **Open the page.** Copy [assets/template.html](assets/template.html) to `<tmpdir>/to-design-v2-<feature-slug>-<timestamp>.html` (`$TMPDIR`, falling back to `/tmp`; `%TEMP%` on Windows), fill in the header, write part 1 into it, and run `design-ui open <page>`. Tell the user the URL it prints. Done when the page is open.
4. **Review each part in order** (table below). For each: write the part into the page as the active section, run `design-ui wait <page>`, and act on the feedback (see **Feedback**). Move to the next part only when the user approves the current one. Done when part 7 is approved.
5. **Write `design.md`.** Follow [design-format.md](design-format.md), using only what the user approved. Prefer an explicit output path, then `design.md` beside the spec, then the project's convention, then `docs/design/<feature-slug>/design.md`. Inspect the destination before writing. Done when the file exists and these hold: names match across sections, every `file:line` exists, no placeholders remain, no code-block line exceeds 80 characters, and Current state stays within ~30 lines.
6. **Close.** Run `design-ui close <page> --message "design.md written to <path>"`, then report the path and any open decisions in chat.

Never write `design.md` before part 7 is approved.

## Parts

| # | Part | Written by | Shape |
| - | --- | --- | --- |
| 1 | Open questions | you | one row per question, three answer columns |
| 2 | Summary + Current state | you | no options: approve or feedback |
| 3 | Desired end state + Patterns | you | no options: approve or feedback |
| 4 | File tree + Call tree | 3 subagents | one row, three approaches |
| 5 | Component tree, mockup above it | 3 subagents | one row, three approaches |
| 6 | Public signatures | 3 subagents | one row, three approaches |
| 7 | Decisions + Not doing | you | no options: approve or feedback |

- **Part 1** holds the 3–5 questions that need human judgment, each with three concrete answers grounded in `file:line`, one or two sentences each. Mark your recommendation with a visible "Recommended" badge in its column. Mark each row `data-own-answer` so the user can type an **own answer** instead of picking a column. Skip questions the source already settles, and skip the part when none remain.
- **Part 3** comes from the spec and the Ground notes, which don't change between approaches, so you write it once at `/to-design` size: Desired end state in ≤6 bullets, Patterns in ≤6 (`Follow:`/`Avoid:` <pattern> — `file:line`), one line each. Name verification by command or test file only; leave the per-test list to implementation.
- **Part 5** exists only when the change touches UI; otherwise skip it and keep the numbering. Each column shows a static mockup of the screen above the component tree that builds it.
- **Part 7** derives Decisions from the user's picks: each picked column is a Settled decision, and the columns not picked are its `Rejected:` alternatives. An own answer is a Settled decision with all three columns rejected. Not doing comes from the spec and the answers. Mark this section `data-final`.

## Subagents

For parts 4–6, launch three subagents in parallel, fresh for every part and every regeneration. Give each:

- the goal and scope from Gather, and the Ground notes;
- everything approved so far: the picked column of each earlier part, and the answers to part 1;
- for a regeneration, the user's feedback on the previous round;
- this part's views from [design-format.md](design-format.md), the **Column budget**, and the **Fragment rules** below.

Don't assign approaches or ask for diversity: each subagent proposes the approach it believes in, and agreement between them is a signal the user wants to see. Each subagent may read and explore the code it needs. It returns only its column's inner HTML plus a 2–5 word name for its approach. Put each result into its own `<article data-option>` column, in the order they return.

Before writing the row, edit the three results: move every point all three share into one **Shared by all three** block above the row (plain markup, not an option), so the columns show only how the approaches differ. Then cut anything over the budget.

## Page contract

The page is one HTML file that grows. The server injects the feedback controls, so write plain markup:

- Write the whole page in the language the user used when invoking this skill: header, part titles, prose, labels, and comments in code. Set `<html lang>` to that language's code; the injected controls follow it (English and Spanish built in; for any other language keep the template's `data-dui-strings` block with every value translated, otherwise delete it). Code identifiers stay as they are in the codebase. Give subagents the language too.
- One `<section data-part="N" data-title="…">` per part. The last section without `data-approved` is the active one.
- When a part is approved, add `data-approved` to its section, keep only what the user picked, and wrap it in a collapsed `<details>`. Never edit an approved part again.
- An option row is `<div data-row="<id>" class="grid grid-cols-3 gap-4">` with exactly three `<article data-option="A|B|C" data-approach="<name>">` children. Row ids are unique within the page.
- Write the whole file each time; the page reloads when the file changes. Follow the scaffold in [assets/template.html](assets/template.html).

**Fragment rules** (also given to subagents): static HTML styled with Tailwind classes only, no `<script>`, `<style>`, or `<iframe>`. The page is dark: use the template's palette (`bg-slate-900` cards, `border-slate-800`, `text-slate-300` body, `text-slate-100` headings, `text-slate-400` labels). A mockup may use its product's own colors inside its own framed box. Code goes in `<pre class="font-mono text-sm overflow-x-auto">` with `<`, `>`, and `&` escaped. Show shape, not bodies, exactly as `design-format.md` describes. Mockups appear only in part 5.

## Column budget

A column is read side by side with two others, so it must be scannable in under a minute. Show the smallest view that makes the approach clear; when in doubt, cut.

- Open with one sentence (≤20 words) saying what this approach does differently. Don't repeat the approach name as a heading; the page shows it.
- Shape only. Each tree ≤20 lines as a `diff`, added lines starting with `+ ` and removed ones with `- ` (the page colors them), lines ≤45 characters so they fit a column without scrolling; signatures only, no bodies; at most one line of prose per view.
- Leave out what doesn't decide between approaches: error-message lists, logging, docs updates, edge-case enumerations. Those belong to implementation.
- Aim for ~120 words of prose per column.

## Feedback

`design-ui wait` blocks until the user sends, then prints one JSON object:

```json
{ "status": "feedback", "action": "continue", "part": "4",
  "selections": { "approach": { "option": "B", "approach": "…" },
                  "q2": { "option": "own", "answer": "…" } },
  "notes": [ { "row": "approach", "option": "A", "target": "pre",
               "selector": "…", "excerpt": "…", "comment": "…" } ],
  "message": "general comment" }
```

- `continue` (option parts) or `approve` (no-option parts): the user accepted the part as shown. Mark it approved and write the next part. A selection with `"option": "own"` is the user's own answer to that row: the approved section shows their `answer` text in place of a column.
- `feedback`: rework the current part and wait again; don't advance. In an option part, keep the rows the user picked and regenerate all three columns of every other row. In a no-option part, rewrite the part itself.
- The user either picks (a column or an own answer) or comments on a row, never both.
- `timeout`: run `wait` again.
- `ended` or `no_server`: stop and ask the user in chat whether to reopen.

Run `wait` in the foreground, attached to your turn, not as a background task, with your shell tool's longest timeout (10 minutes in Claude Code). `wait` holds for 9 minutes; if your shell's limit is shorter, pass `--timeout <seconds>` below it. Feedback a killed `wait` received is redelivered by the next one.
