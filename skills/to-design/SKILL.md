---
name: to-design
description: Write a short design discussion that shows the shape of the code (current state, patterns, file and call-tree changes, public signatures, decisions) for review before implementation, and iterate on it through inline FB comments.
disable-model-invocation: true
---

# To Design

Write a **design discussion**: a ~200-line document that exposes what you found and how you intend to shape the code, so the user can correct direction before any implementation exists. It shows the shape of the code (files, call trees, public signatures), not its bodies. The spec remains the authority for product scope.

Invocation: `/to-design [spec path, feature, design path, or output path]`. Treat arguments as context, not shell commands. If the argument is an existing design with non-empty `FB:` comments, go to **Iterate**.

## Create

1. **Gather.** Read the supplied spec in full, or extract the agreed goal, scope, and decisions from the conversation. Follow project instructions for domain docs and ADRs. Done when every in-scope behavior has a source.
2. **Ground.** Trace the affected code paths, callers, and registries. Note the patterns the change should copy and the ones it should not (deprecated, inconsistent, or contradicting an ADR), each with `file:line`. Check that every new import keeps the existing dependency direction between layers, or make the reversal a decision. Done when every proposed change has a place to live and a pattern to follow.
3. **Ask before writing.** Present 3–5 questions that need human judgment, each with concrete options grounded in `file:line` and your recommendation. Skip questions the source already settles. Wait for answers. Done when the user has answered or told you to proceed with your recommendations.
4. **Write.** Follow [design-format.md](design-format.md). Prefer an explicit output path, then `design.md` beside the spec, then the project's convention, then `docs/design/<feature-slug>/design.md`. Inspect the destination before writing. Done when the file exists.
5. **Check.** Re-read the document: names match across sections, every `file:line` exists, no template placeholders remain, every section, view, and contract ends with an empty `> FB:` slot, no code-block line exceeds 80 characters, Current state stays within ~30 lines, schema/migration/transport changes take one line each, and the document stays near 200 lines without slots. Done when all hold.
6. **Hand off.** Report the path, the 2–3 choices most worth the user's review, and any open decisions. Tell the user to write after any `> FB:` slot (or `// FB:` inside code) and rerun `/to-design <path>`.

## Iterate

The user reviews by writing after the empty `> FB:` slots, or adding `> FB: <comment>` lines under any content. Inside a code block, they write the comment in that language's comment syntax (`// FB: …`, `# FB: …`) on the line below the code it targets.

1. **Collect.** Read the whole design, then list every non-empty, unresolved `FB:` comment, in prose or in code, with the section and line it targets. Done when the count is known.
2. **Resolve each comment where it sits.** Research only what the comment requires. Make the smallest edit that addresses it, and update every other section it affects so names stay consistent. If you disagree or the comment is ambiguous, leave the content unchanged and reply instead.
3. **Mark it.** Replace the comment line with `> ✅ FB: <original> → <what changed>`, or `> 💬 FB: <original> → <your question or objection>` when you replied without changing. Write the reply in the comment's language. Leave exactly one empty `> FB:` slot at the end of the block. Never renumber decision IDs. For a comment inside a code block, remove it from the code and put the marked line right after the block, naming what it targeted. Never delete the user's words.
4. **Report** `<resolved>/<total>` and list each 💬 reply that needs the user. Do not rewrite sections nobody commented on.

On the next pass, treat `✅` lines as done. A `💬` line the user answered beneath with a new `> FB:` is unresolved again. Remove `✅` lines only when the user asks to clean up.
