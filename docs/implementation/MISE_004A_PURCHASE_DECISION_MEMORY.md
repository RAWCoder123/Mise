# MISE-004A purchase decision memory

## Boundary

MISE-004A records explicit operator decisions on Mise-generated purchase
recommendations. It is evidence and presentation only. It is not purchase
authority, a forecasting input, an autonomy rule, an LLM memory, or a generic
restaurant-memory substrate.

## Event contract

`public.purchase_decision_events` is append-only and tenant scoped. Base events
are `approve`, `approve_with_override`, or `dismiss`. `undo` and
`exclude_from_learning` are compensating events that point to one base event.
An exact operational replay emits no new event.

Approval and dismissal wrappers retain the full locked MISE-003A/003C workflow
behind private revoked bases. A system-recommendation event is written after an
applied result but before the surrounding transaction commits. If event
validation or insertion fails, the recommendation, supplier draft, audit, and
event all roll back together. Undo follows the same rule when a corresponding
post-deployment base event exists. Historical/manual work remains operationally
undoable without inventing evidence.

Quantities and `quantity_delta` are stored in the exact operator-facing purchase
unit. Canonical quantities and a separately derived `canonical_quantity_delta`
use the inventory item's verified action-time conversion factor. This permits
deterministic comparison across packaging changes while retaining what the
operator actually saw and chose.

## Pattern contract

Pattern version: `mise.purchase_pattern.v1`

Evidence version: `mise.purchase_decision.v1`

Minimum active comparable samples: `5`

Established consistency: `80%`

Comparable evidence shares inventory item ID, durable supplier ID, canonical
unit, recommendation source, and evidence version within one restaurant.
Actor identity and supplier display name do not split a pattern. Undo and
exclusion remove the referenced base event from active aggregation without
deleting it.

The aggregate reports counts, approval and dismissal rates, upward/downward and
exact outcomes, median chosen-to-suggested ratio, median canonical delta,
recency, bounded evidence IDs, eligibility, evidence strength, dominant factual
outcome, and whether the supplier/canonical context still matches the item.

Patterns are calculated on read from committed events. This keeps the evidence
rebuildable and gives concurrent readers normal PostgreSQL transaction
visibility: an uncommitted decision is absent; every later read includes the
committed event.

## Explicit exclusions

MISE-004A does not use these patterns to generate or modify recommendations.
It adds no embeddings, vectors, LLM calls, free-form memory, prediction labels,
or personality language. Historical audits are not backfilled because they
lack the required canonical and action-time evidence.

Bounded recommendation-quantity influence from established patterns is
MISE-004B; see `docs/implementation/MISE_004B_PATTERN_ADVISORY_QUANTITY.md`.
