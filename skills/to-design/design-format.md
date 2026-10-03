# Design document format

Write a concrete proposal the user can inspect before implementation: file map, UML, path-based sections, declarations, UI snippets, transport schemas, worked examples, and pending contract decisions. Make file placement, module responsibilities, public signatures, and relationships visible together. Derive architecture, names, units, transports, and policies from the feature being designed.

Use the sections below in this order. Omit conditional sections when the feature has no corresponding concern. Put shared rules in their owning section and reference them from callers. Keep every invariant in one authoritative place.

## Title and goal

Start with `# <Feature> design — <organizing decision>` and a `Design state: draft | ready` line. Link the source spec or identify the conversation decisions used. State the goal, scope, key domain meanings, and relevant constraints in a short `## Goal` section. Mark material evidence gaps explicitly.

## File map

Use `## File map` with this table:

| File | Change | Export / kind | Responsibility |
| --- | --- | --- | --- |
| Concrete repository-relative path | Existing / modified / new / removed | Exact symbol and function/class/type/etc. | One concrete responsibility |

Include affected public exports and registration points. Group shared helpers or integrations outside the feature under a separate subheading. Account for moved-file origins and consumers whose imports must change. Explain the feature's organizing decision and why a helper belongs inside or outside it.

## UML

Use `## UML` with a fenced Mermaid diagram showing callers, rule-owning modules, persistence, models, helpers, and external integrations that matter to this design. Use `classDiagram` for class-based designs; use a dependency `flowchart` when functions/modules describe the architecture better.

Label function modules, model types, UI functions, exception classes, and external nodes accurately. Draw dependencies that match the contract; label runtime calls and type relationships distinctly. Prefer responsibilities and important operations over every private method. Add a short legend when needed.

## Utilities

Use `## Utilities — <path>` for domain helpers. Include their purpose, exported declarations, and compact function bodies when these clarify response shaping or formatting. Distinguish public response shapes from internal models and display conversions from stored values. Show client/server export boundaries when relevant.

## UI

Under `## UI`, give each participating surface a `### <Component> — <path>` heading, concrete props or public interface, and a compact structural snippet or state model. Show the fields, actions, and conditional create/edit/delete states that matter. Describe loading/empty/error states, validation feedback, accessibility/focus behavior, and navigation or refresh effects that belong to the feature.

Keep snippets focused on decisions and interactions; the document specifies behavior rather than supplying a complete implementation.

## Controllers and transports

Group entry points under `## Controllers` and/or transport-specific headings such as `## MCP tools`, matching the actual application.

For each web action, HTTP endpoint, command, event handler, or tool:

- Give its concrete path, exported signature or registration name, and authentication/authorization source.
- Define accepted inputs, validation/mapping, delegation to the rule-owning module, success output, and error mapping.
- Identify registration, permissions/scopes, response headers, redirects, metadata, or output schemas when they are part of its contract.
- Include a worked request/response or invocation/result example for each operation. Use exact values that obey the model and any clock/locale assumptions.

For HTTP, use a method/input/delegation/success table followed by an operation subsection for each endpoint behavior. Show actual request/response pairs, status codes, headers, query encoding, and body shapes. Map transport fields to domain inputs explicitly when their shapes differ.

For tools, show a representative registration declaration with its name, permissions/scopes, input/output schemas, annotations, and handler delegation where supported. Follow it with input and structured-output examples. Document text output separately, and distinguish registry/schema refusal from handler-generated errors. Give registration and shared error behavior their own subsection.

Reuse example IDs, values, clock, locale, and initial state across equivalent transports so readers can compare results. Explain shared rules and presentation differences, including follow-up reads or summaries after a mutation.

## Exceptions and errors

Use `## Exceptions — <path>` or the project's result/error equivalent. Show typed errors, codes, and representative declarations. Use a failure/cause/handler-behavior table covering each participating transport. Specify which module validates, which catches/translates, and how unexpected failures propagate. Explain how nullable persistence results become domain failures and how missing and foreign targets are exposed to callers.

## Rule-owning interfaces

Give each participating service/domain module a heading such as `## Service interface — <path>` and a representative interface in the project's language. Name every public operation with concrete parameter and return types. Pair signatures with the caller contract: invariants, creation versus update semantics, immutable fields, validation, ownership, ordering, idempotency, and failure behavior as applicable.

Make transaction boundaries and multi-step side effects explicit. State what remains persisted when a later step fails, or reference the pending decision that controls it. Match promises/async returns and nullable results to the proposed implementation model.

## Persistence interfaces

Use a heading such as `## Repository interface — <path>` for each persistence module. Include concrete signatures, lookup-miss behavior, scoping, ordering, deduplication/count semantics, and atomicity relevant to callers. Keep business rules with their owning module and identify constraints enforced by storage.

## Database and migration

Use `## Database — <schema path>` for schema changes. Name the storage object and list fields, types, nullability, keys, indexes, and mappings to domain values. Under `### Migration`, cover conversions, backfills, existing data, compatibility with deployed consumers, rollout order, and rollback limitations where applicable. Identify irrecoverable historical information rather than inventing it.

State which identities, ownership, and values the migration preserves, and its failure or interruption behavior. If no migration is needed, state that briefly in the persistence section.

## Models and helpers

Under `## Models and helpers`, use `### Models — <path>` for concrete model/input/result declarations, followed by `### Example values` with valid values for each input variant and result. Define units, precision, time/zone representation, normalization, ranges, ordering, and tie-breakers where applicable. Explain internal versus public fields and discriminated input variants.

Put generic shared helpers in a final section such as `## Shared date-time utilities`, with a subheading for each concrete path. Show exported signatures, accepted/rejected input-output examples, callers, and why the helper sits outside the feature. Reference these definitions from earlier contracts instead of repeating their rules.

## Decisions requiring input

Include this section when choices remain. Use one entry per stable decision ID:

- **ID:** D-01
- **Question:** One unresolved policy or architectural choice.
- **Options:** Concrete alternatives and their tradeoffs.
- **Recommendation:** Proposed choice and its rationale, explicitly pending user decision.
- **Affects:** Operation names and contract sections.

Maintain settled decisions in their owning contract sections. When updating a document, retain their IDs where existing references rely on them.
