---
name: to-design
description: Turn a spec or grill-me conversation into a concrete technical design with a file map, UML, interfaces, and worked examples.
disable-model-invocation: true
---

# To Design

Write a **design contract**: the concrete structure, interfaces, and behavior an implementer needs after `/to-spec` or `/grill-me`. Work from the conversation, a supplied spec, or both. Paths, declarations, UI snippets, and worked request/response examples make the contract reviewable; the spec remains the authority for product scope.

Invocation: `/to-design [spec path, feature, or output path]`. Treat arguments as context, not shell commands.

## Process

### 1. Gather the decisions

Read the supplied source in full, including linked clarifications and comments. For a conversation-only invocation, extract the agreed goal, scope, constraints, and decisions from the conversation. Follow project instructions for domain docs, ADRs, and issue-tracker operations before exploring or locating documents.

Use the current feature when it is unambiguous. Ask for the source or feature only when the available context cannot identify what to design. Reuse the completed interview; capture remaining decisions in the document rather than starting another grilling session.

Done when each in-scope behavior and agreed decision has a source, and conflicting or missing decisions have been identified.

### 2. Ground the design

Inspect the affected implementation, callers, exports, route/tool registries, and persistence. Follow the actual call paths far enough to identify integrations outside the feature. Use the project's domain vocabulary and flag any proposed contradiction with an ADR by name and rationale.

Distinguish **existing**, **modified**, **new**, and **removed** files. Verify existing symbols and signatures; label proposed symbols as proposed. Preserve the project's architecture and language conventions, including asynchronous returns. Choose modules and layers for the feature's responsibilities.

Done when every proposed operation has an entry point, an owner for its rules, a persistence or side-effect path where applicable, and identified callers affected by the change.

### 3. Resolve the contract on paper

Translate accepted decisions into concrete interfaces, data shapes, invariants, errors, and examples. Treat observed code as current behavior, not automatic approval of future behavior. Label new architectural choices as proposals unless the source already settles them.

Assign unresolved choices stable IDs (`D-01`, `D-02`, ...). Record each question, options, recommendation with rationale, and affected operations once in the decision ledger. Reference those IDs from dependent sections. Keep accepted assertions separate from outcomes that depend on a pending decision.

Done when every operation has explicit inputs, outputs, side effects, failure behavior, and either settled semantics or named decision dependencies. Each participating transport maps to the same domain contract; any differences are explicit.

### 4. Write the document

Read [design-format.md](design-format.md) and use its section order and concrete presentation. Adapt sections to the feature; include only layers and transports that participate in the change. Write each component or module under its concrete path, with declarations and examples detailed enough to implement its public contract.

Prefer an explicit output path, then `design.md` beside the selected local spec. Otherwise follow the project's design-document convention; if none exists, use `docs/design/<feature-slug>/design.md`. Inspect the destination before writing. When updating an existing design, preserve accepted decisions, stable IDs, and user-authored notes, and reconcile stale sections with the new source.

Write the technical design artifact only. Describe behavior through contracts and worked examples; keep test plans and test cases in their own workflow. Implementation, ticket publication, and changes to source specs or tracker state require their own task. Follow any project metadata requirements that apply to design documents.

Done when the document exists at the selected destination and covers every in-scope behavior, affected integration, and unresolved choice.

### 5. Audit consistency

Read the saved document and check:

- Every file-map export, diagram node, interface, and example refers to the same names and responsibilities.
- Input types, units, optionality, nullability, async behavior, ordering, errors, and transport mappings agree across sections.
- Every public operation has a worked example, and its contract describes success and reachable failure behavior. Decision-dependent outcomes reference a real decision ID.
- Source requirements are all covered, or explicitly excluded with a source-backed reason. Proposed design choices are recognizable as proposals.
- Markdown links resolve, Mermaid fences are complete, decision IDs are unique, and template placeholders have been replaced.

Fix inconsistencies in the artifact. Mark its design state **draft** while decisions or material evidence gaps remain; use **ready** only when the contract is fully specified. This state describes the design contract's completeness.

Done when all checks pass and the design state matches its remaining gaps.

### 6. Hand off

Report the saved path, design state, and any decisions requiring input. The next workflow can use the spec and design together for `/to-tickets` or implementation.
