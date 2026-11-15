# Coding standards

These are the defaults for every project. Each project can have its own `docs/agents/coding-standards.md` with the same two sections. Where it says something, it wins. Where it is silent, these defaults apply.

- **Where code goes** decides the shape of the code. The implementer, the code reviewer and the refactorer follow it.
- **Definition of done** decides when a story is finished. The lead checks it; the implementer and the refactorer run its checks before reporting.

## Where code goes

A project's own file adds what only that project knows:

- the reference feature to copy, with its layer map;
- its rules (where requests, state and shared helpers live);
- which module owns which data;
- the allowed direction of dependencies;
- known debt that must not be copied.

The defaults:

- **Follow the sibling flow.** Copy the layering, naming and error handling of the closest existing feature. When siblings disagree with each other, follow the newest one, and say which one you followed. Code listed as known debt is never the sibling to copy.
- **The owner holds the logic.** Logic goes into the module that owns its data. For example, changing a password belongs in the users service: not in auth, and not in a new `PasswordService`.
- **One module per feature.** A feature's UI, requests and state live together in their own module (`water/`). Related features are submodules of a shared parent (`settings/daily-goals`).
- **Earn every file.** Add a class, file or layer only when two callers need it or the project's pattern requires it. You should be able to justify each new file in one sentence the user would accept. Otherwise, inline it where it is used.
- **Share the rules.** One validation schema serves both client and server. One form serves both add and edit.
- **Import narrowly.** A module depends on what it uses, not on a bigger module that happens to export it. A general helper does not live inside a feature module that others import from.
- **Keep seed and test code out of production paths.** Seeding, fixtures and test switches stay in scripts and tests, not in services or startup code.

## Definition of done

A story is done when every category below holds. The categories are the same for every project. A project's own file gives the **command** for each category in its language and tools, for example `pnpm lint`, `mvn checkstyle:check` or `ruff check`.

| # | Category | Holds when |
| --- | --- | --- |
| 1 | Tests | The full suite passes and no test was changed |
| 2 | Coverage | It meets the project's threshold |
| 3 | Formatting | The format check reports no file to change |
| 4 | Lint | No errors |
| 5 | Types | The type check or the compile passes, when the language has one |
| 6 | Dependencies | The audit reports no vulnerability of high or critical severity that the base branch did not already have |
| 7 | UI, when the story has UI | A screenshot of every scenario that shows UI, at desktop and phone width, matches the story's texts and the mockup, if there was one |
| 8 | Backend, when the story has endpoints | A `curl` for every scenario that calls an endpoint shows the real request and response: method, URL, the headers that matter, status and body, with secrets redacted |

For category 6, vulnerabilities that already exist on the base branch do not block the story. They are listed in the report.

A project's file looks like this:

| # | Category | Command |
| --- | --- | --- |
| 1 | Tests | `pnpm test` |
| 2 | Coverage | `pnpm test:coverage` (threshold 90%) |
| 3 | Formatting | `pnpm format:check` |
| 4 | Lint | `pnpm lint` |
| 5 | Types | `pnpm typecheck` |
| 6 | Dependencies | `pnpm audit --audit-level=high` |
| 7 | UI | `pnpm dev`, web at `http://localhost:3000` |
| 8 | Backend | API at `http://localhost:3001/v1` |

When the project has no tool for a category, its file says so (`none`). The category is then left out of the run and named in the report, never skipped in silence.
