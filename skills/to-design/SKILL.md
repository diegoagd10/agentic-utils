---
name: to-design
description: Propose an interactive HTML technical design for review, with concrete file paths, signatures, SVG UML, and feedback on each part.
disable-model-invocation: true
---

# To Design

Write a self-contained **HTML design contract** for the user to review before implementation: what will change, where files will live, which responsibilities each module will own, and the proposed signatures and relationships. Work from the conversation, a supplied spec, or both, including after `/to-spec` or `/grill-me`; the spec remains the authority for product scope.

Invocation: `/to-design [spec path, feature, or output path]`. Treat arguments as context, not shell commands.

## Process

### 1. Gather the decisions

Read the supplied source in full, including linked clarifications and comments. For a conversation-only invocation, extract the agreed goal, scope, constraints, and decisions from the conversation. Follow project instructions for domain docs, ADRs, and issue-tracker operations before exploring or locating documents.

Use the current feature when it is unambiguous. Ask for the source or feature only when the available context cannot identify what to design. Reuse the completed interview; capture remaining decisions in the document rather than starting another grilling session.

Done when each in-scope behavior and agreed decision has a source, and conflicting or missing decisions have been identified.

### 2. Ground the design

Inspect the affected implementation, callers, exports, route/tool registries, and persistence. Follow the actual call paths far enough to identify integrations outside the feature. Use the project's domain vocabulary and flag any proposed contradiction with an ADR by name and rationale.

Distinguish **existing**, **modified**, **new**, and **removed** files. Verify existing symbols and signatures; label proposed symbols as proposed. Follow the project's architectural constraints and language conventions, including asynchronous returns. When restructuring is in scope, show which existing boundaries change and why. Choose modules and layers for the feature's responsibilities.

Done when every proposed operation has an entry point, an owner for its rules, a persistence or side-effect path where applicable, and identified callers affected by the change.

### 3. Resolve the contract on paper

Translate accepted decisions into concrete interfaces, data shapes, invariants, errors, and examples. Treat observed code as current behavior, not automatic approval of future behavior. Label new architectural choices as proposals unless the source already settles them.

Assign unresolved choices stable IDs (`D-01`, `D-02`, ...). Record each question, options, recommendation with rationale, and affected operations once in the decision ledger. Reference those IDs from dependent sections. Keep accepted assertions separate from outcomes that depend on a pending decision.

Done when every operation has explicit inputs, outputs, side effects, failure behavior, and either settled semantics or named decision dependencies. Each participating transport maps to the same domain contract; any differences are explicit.

### 4. Build the HTML artifact

Read [design-format.md](design-format.md) and use its section order and concrete presentation. Start from [design-template.html](design-template.html), replace its title, design ID, and main content, and keep its feedback controls working. Adapt sections to the feature; include only participating layers and transports. Put each component or module under its concrete path, with its responsibility, declarations, and examples together.

Generate the UML yourself as inline SVG with labeled nodes and relationships; give every reviewable node and relationship a stable feedback ID. Show each node's concrete file path and brief purpose in the diagram or a directly linked file card. Use HTML tables, code blocks, and short labels for detail. Limit each visible paragraph and semantic section to two generated sentences total, counting sentences in tables and lists; write remaining entries as fragments. Give each file's purpose at most two sentences, and preserve user-authored feedback verbatim.

Prefer an explicit `.html` output path, then `design.html` beside the selected local spec. Otherwise follow the project's design-document directory convention; if none exists, use `docs/design/<feature-slug>/design.html`. Inspect the destination before writing. When updating an existing design, preserve accepted decisions, stable IDs, and user-authored notes, and reconcile stale sections with the new source. If replacing a prior Markdown design, read it as input and save the HTML beside it unless the user chose another path.

Write the technical design artifact only. Describe behavior through contracts and worked examples; keep test plans and test cases in their own workflow. Implementation, ticket publication, and changes to source specs or tracker state require their own task. Follow project metadata requirements that apply to design documents.

Done when the document exists at the selected destination and covers every in-scope behavior, affected integration, and unresolved choice.

### 5. Audit consistency

Read the saved document and check:

- Every file-map export, diagram node, interface, and example refers to the same names and responsibilities.
- The user can locate each proposed public signature under its owning file and trace its callers and dependencies without reading implementation code.
- Input types, units, optionality, nullability, async behavior, ordering, errors, and transport mappings agree across sections.
- Every public operation has a worked example, and its contract describes success and reachable failure behavior. Decision-dependent outcomes reference a real decision ID.
- Source requirements are all covered, or explicitly excluded with a source-backed reason. Proposed design choices are recognizable as proposals.
- HTML links resolve, SVG nodes and relationships have unique stable feedback IDs, decision IDs are unique, and template placeholders have been replaced.
- The HTML opens locally without external assets; feedback can be entered for sections and UML parts, survives a reload when storage is available, and exports/imports as JSON.
- Every visible prose paragraph and semantic section has at most two sentences; every file purpose has at most two sentences.

Fix inconsistencies in the artifact. Mark its design state **draft** while decisions or material evidence gaps remain; use **ready** only when the contract is fully specified. This state describes completeness, not user approval of the architecture or authorization to implement it.

Done when all checks pass and the design state matches its remaining gaps.

### 6. Hand off

Open the saved HTML for the user. Report its path, design state, main architectural choices, and decisions requiring input; ask the user to export the feedback JSON when they want their comments incorporated. Once the user accepts the design, the next workflow can use the spec and HTML design together for `/to-tickets` or implementation.
