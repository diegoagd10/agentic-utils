# Design discussion format

Aim for ~200 lines. Show the smallest view that makes each point clear, and put each visual next to the sentence it supports. Show shape, not implementation: no function bodies, no request/response dumps, no per-endpoint error tables. Omit a section when the feature has nothing for it.

```markdown
# <Feature> — design

Source: <spec link or "conversation, <date>">

## Summary
3–5 lines: what changes and the organizing decision behind it.

## Current state
How it works today, at most ~30 lines. One short call tree per entry point the change touches, each under its own `###` heading. Other affected readers get one line each.

## Desired end state
What is true when this ships, and how a reviewer can verify it.

## Patterns
- Follow: <pattern> — `file:line`
- Avoid: <pattern> — `file:line` — why

## Shape of the code
<views below>

## Decisions
### Settled
- **D-01 <decision>:** <choice> — <why>. Rejected: <alternative> because <reason>.
### Open
- **D-02 <question>** — options: A / B. Recommend A because <reason>.

## Not doing
- <excluded scope> — <why>
```

## Decisions

Number decisions `D-01`, `D-02`, … in this document's own sequence; cite spec decisions as "spec D-06". Every option the user picked in the review page becomes a Settled decision; the columns they did not pick become its `Rejected:` alternatives. Record design choices only, not actions taken such as edits to the spec. Write neutrally: attribute a user's choice as "(user, <date>)", never "you" or "your answer".

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

The approved mockup stays in the review page; below the component tree, add one line per screen naming the mockup and its review-page path.

Public signatures only: one block per owning file, under a `####` heading with its path, so each contract reads on its own:

````markdown
#### src/sessions/archive.ts

```ts
export function archiveIdleSessions(olderThan: Duration): Promise<ArchiveResult>
```
````

Use a Mermaid sequence or state diagram only when ordering or state transitions are the point. Mention schema changes, migrations, or transport changes in one line each; if one is risky, make it a decision.
