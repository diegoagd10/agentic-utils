# Design discussion format

Aim for ~200 lines. Show the smallest view that makes each point clear, and put each visual next to the sentence it supports. Show shape, not implementation: no function bodies, no request/response dumps, no per-endpoint error tables. Omit a section when the feature has nothing for it.

```markdown
# <Feature> — design

Source: <spec link or "conversation, <date>">

> Review: write after any `> FB:` (inside code: `// FB: …`), then run `/to-design <this file>`.

## Summary
3–5 lines: what changes and the organizing decision behind it.

> FB:

## Current state
How it works today, at most ~30 lines. One short call tree per entry point the change touches, each under its own `###` heading. Other affected readers get one line each.

> FB:

## Desired end state
What is true when this ships, and how a reviewer can verify it.

> FB:

## Patterns
- Follow: <pattern> — `file:line`
- Avoid: <pattern> — `file:line` — why

> FB:

## Shape of the code
<views below>

## Decisions
### Settled
- **D-01 <decision>:** <choice> — <why>. Rejected: <alternative> because <reason>.
### Open
- **D-02 <question>** — options: A / B. Recommend A because <reason>.

> FB:

## Not doing
- <excluded scope> — <why>

> FB:

## Review
General comments that don't belong to one section.

> FB:
```

## Comment slots

End every `##` section, every `###` view, and every `####` contract with exactly one empty `> FB:` line, so the reviewer always has a visible place to write under the thing they are reviewing. Slots don't count toward the ~200 lines.

## Decisions

Number decisions `D-01`, `D-02`, … in this document's own sequence; cite spec decisions as "spec D-06". Never renumber an existing ID, because the spec and comments refer to it: a superseded decision keeps its ID and says which one replaced it, and a new decision takes the next unused number. Record design choices only, not actions taken such as edits to the spec. Write neutrally: attribute a user's choice as "(user, <date>)", never "you" or "your answer".

## Readability

Reviewers read this in Markdown viewers such as Obsidian, where code blocks do not wrap.

- Keep every line inside a code block under 80 characters. Split wide content into more blocks instead.
- One column per block: never place two trees or tables side by side.
- Put `file:line` at the end of a line as a `# file:line` comment, not between names.
- Prefer a bullet over a dense paragraph; keep each bullet to one idea.

Current state example:

````markdown
### Session page — src/routes/session.tsx

```text
loader
  SessionService.read(sessionId)           # src/sessions/service.ts:42
action
  SessionService.archive(sessionId)        # src/sessions/service.ts:87
```

> FB:
````

## Shape of the code

Use the views the change needs; most designs need two or three, each under its own `###` heading. Show changes as `diff` against the existing shape.

File tree, one responsibility per line. Include registration points (route tables, config) and the consumers whose imports change when a symbol moves:

```diff
 src/
 ├── sessions/
 │   ├── service.ts        # owns session rules
+│   └── archive.ts        # archives idle sessions
-└── utils/archive.ts
```

Call tree for runtime flow:

```diff
 submitForm
   createSession
     persistPrompt
+    expandSkillMention
     launchAgent
```

Component tree for UI, with the state that matters:

```tsx
<SessionPage> (src/routes/session.tsx)
  useSessionEvents()
  <SessionToolbar>
+   <ArchiveButton onArchive />
```

Public signatures only: one block per owning file, under a `####` heading with its path, so the reviewer can comment on each contract separately:

````markdown
#### src/sessions/archive.ts

```ts
export function archiveIdleSessions(olderThan: Duration): Promise<ArchiveResult>
```

> FB:
````

Use a Mermaid sequence or state diagram only when ordering or state transitions are the point. Mention schema changes, migrations, or transport changes in one line each; if one is risky, make it a decision.
