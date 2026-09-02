# Square line-item modifier sync metadata (2026-09-02)

Tip: `cursor/mise-square-line-item-modifiers-sync` on `origin/main` @ `20b28e5`.

## Closed
1. Parse Square `line_items[].modifiers` during order search (catalog-backed ids only).
2. Persist bounded summary on `sales_imports.metadata` via scoped apply (`p_modifier_summary`).
3. Return counts/sample on sync-pos-sales response; webhooks pass the same bag.
4. POS hub surfaces modifier pressure after sync / from latest completed import.
5. Demo parity returns Extra Cheese sample without inventing sale rows.
6. EN / ES / zh-Hans copy.

## Explicit non-goals
No POS depletion wiring; no `#341` modifier CRUD duplication; no MOQ / lead_time / expiration invention; no Today / Home task generation.

## Proof
- `npm run typecheck`
- `npm test` (owned Square + demo modifier tests pass; suite retains inherited hung-cycle cancellations)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
