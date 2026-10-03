# HTML design format

Build a single, self-contained `design.html` from `design-template.html`. Replace the sample title and design ID, then fill `<main id="design">` with the sections below in order; omit sections that do not apply.

## Brevity and review anchors

Each visible paragraph and semantic `<section>` contains at most two generated sentences total, including sentences in lists, captions, and table cells; use fragments, declarations, examples, and SVG labels for the rest. Each file purpose has at most two sentences, ideally one, and every file or contract section has a unique, stable `data-review-id` that survives revisions.

The template adds a review button to each anchored section. Give every SVG node and relationship its own anchored `<g>` with `tabindex="0"`, `role="button"`, and a useful `aria-label`; the template lets the reader mark it **Me gusta**, **Cambiaría**, or **Pregunta**, add a note, and export/import the feedback JSON.

## Title and goal

Set a feature-specific `<title>`, `<h1>`, and `data-design-id`, plus a visible `Design state: draft | ready`. Link the source spec or name the conversation decisions, then state goal, scope, domain meanings, constraints, and material evidence gaps in a `Goal` section.

## File map

Use a table with columns `File`, `Change`, `Export / kind`, and `Purpose`; each row names a concrete repository-relative path and an exact symbol. Distinguish existing, modified, new, and removed files, including registration points, moved-file origins, and import consumers; explain placement in at most two sentences below the table.

## UML

Draw the design directly in inline `<svg>` with a `viewBox`, `<title>`, readable text, accessible labels, and arrows or lines for dependencies. Keep child `<g role="button">` elements exposed to assistive technology by leaving the outer SVG without `role="img"`; choose class-style or module boxes for the architecture at hand.

Show callers, rule owners, models, persistence, helpers, and external integrations that matter. Each node shows its concrete file path and brief purpose, or links to a file card immediately below the SVG; label runtime calls and type relationships distinctly, match names to the file map, and use this anchor pattern:

```html
<g class="uml-part" data-review-id="uml:service" tabindex="0"
   role="button" aria-label="Review OrderService, src/order/service.ts">
  <rect x="20" y="20" width="200" height="90" rx="8" />
  <text x="32" y="45">OrderService</text>
  <text x="32" y="69">src/order/service.ts</text>
  <text x="32" y="92">Validates orders</text>
</g>
<g class="uml-part" data-review-id="uml:controller-service" tabindex="0"
   role="button" aria-label="Review controller calls OrderService">
  <path d="M 220 65 L 300 65" marker-end="url(#arrow)" />
  <text x="233" y="53">calls</text>
</g>
```

## File and contract sections

Give each participating file its own section headed by its concrete path, with a `Purpose` field of at most two sentences. Place public signatures, inputs, outputs, side effects, failure behavior, callers, dependencies, and a worked example beside that file; use compact tables and code blocks instead of long prose.

For UI files, show props or public interface, actions, create/edit/delete states, loading/empty/error states, validation feedback, focus, and navigation effects. For controllers and transports, show authorization source, accepted inputs, mapping to the domain contract, success/error outputs, registration or route details, and a worked request/response for each public operation.

For rule-owning services, show invariants, immutable fields, ordering, idempotency, transaction boundaries, and later-step failure behavior. For persistence, show lookup misses, scoping, ordering, atomicity, storage constraints, and schema or migration details, including rollout and rollback limits where relevant.

For models and helpers, define types, units, nullability, time representation, normalization, and example values. Keep each rule in one owning place and reference it from callers; show exact conversions between internal, transport, and display shapes.

## Decisions requiring input

Include a reviewable section when choices remain, with one row or block per stable ID (`D-01`, `D-02`, ...). Show question, options and tradeoffs, recommendation and rationale, affected operations, and the decision's pending status; reference the ID wherever the contract depends on it.

## Review and validity

Make every section and UML part addressable by a unique feedback ID, and retain IDs when updating the artifact so exported comments still point to the same part. Keep the HTML self-contained, escape source text before inserting it into markup, replace all template placeholders, and check links, SVG labels, keyboard focus, feedback save, and JSON export/import in a browser.
