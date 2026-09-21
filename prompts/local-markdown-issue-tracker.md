Use local Markdown files as this repository's issue tracker. Store them outside
Git under ~/.tickets/<project>/, where <project> is the repository name. For
example, Cairn uses ~/.tickets/cairn/. Resolve the name from the Git remote
when available, falling back to the repository root directory name. Reuse the
same project directory for its worktrees. If the chosen directory already
belongs to a different project, ask me for a name before writing there.

Create the project directory and configure Matt Pocock's engineering skills to
use it for specs, tickets, triage, blockers, and progress. Treat this as the
"Other" tracker option. All tracker operations are filesystem reads and writes.
Expand ~ to my home directory when accessing files. Follow the normal setup
flow for triage labels and domain docs. Preserve unrelated instructions in
AGENTS.md or CLAUDE.md, and replace any existing tracker instructions that
conflict with this workflow.

Write a self-contained docs/agents/issue-tracker.md in this repository and
link it from the existing AGENTS.md or CLAUDE.md. Record these conventions:

- Each feature has ~/.tickets/<project>/<feature-slug>/spec.md and one file
  per ticket at ~/.tickets/<project>/<feature-slug>/issues/NN-<slug>.md.
- Number tickets in dependency order. Each ticket records its status and its
  "Blocked by" ticket numbers or paths; an empty blocker list means it can
  start immediately. A ticket is ready only when all its blockers are done.
- Put comments and implementation notes in the relevant Markdown file.
- `/to-spec` writes the spec; `/to-tickets` writes separate ticket files and
  their blocking edges; `/triage` updates ticket status; `/implement` reads
  the chosen ticket, its spec, and its blockers, then records completion in
  the ticket file.
- Before creating or changing tickets, inspect the existing project directory
  to avoid duplicates. Keep ticket bodies in Markdown so I can open and edit
  them directly in Visual Studio Code.

Finish by checking that the directory exists, the tracker instructions point
to it, and no setup instructions still direct these skills to another tracker.
Do not create sample specs or tickets.
