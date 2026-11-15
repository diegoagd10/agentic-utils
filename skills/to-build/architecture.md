# Where code goes

The implementer, the reviewer and the refactorer use these rules. When the project has its own architecture notes (`ARCHITECTURE.md`, agent instruction files), those come first. Where the notes are silent, these rules apply.

- **Follow the sibling flow.** Copy the layering, naming and error handling of the closest existing feature. When siblings disagree with each other, follow the newest one, and say which one you followed.
- **The owner holds the logic.** Logic goes into the module that owns its data. For example, changing a password belongs in the users service: not in auth, and not in a new `PasswordService`.
- **One module per feature.** A feature's UI, requests and state live together in their own module (`water/`). Related features are submodules of a shared parent (`settings/daily-goals`).
- **Earn every file.** Add a class, file or layer only when two callers need it or the project's pattern requires it. You should be able to justify each new file in one sentence the user would accept. Otherwise, inline it where it is used.
- **Share the rules.** One validation schema serves both client and server. One form serves both add and edit.
- **Import narrowly.** A module depends on what it uses, not on a bigger module that happens to export it. A general helper does not live inside a feature module that others import from.
- **Keep seed and test code out of production paths.** Seeding, fixtures and test switches stay in scripts and tests, not in services or startup code.
