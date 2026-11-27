# Restaurant memory decision actor INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-restaurant-memory-decision-actor-evidence-main`

## Gap

`restaurant_memories.corrected_by` is nullable so account-deletion anonymization
can clear only the deleted operator's auth identity (`ON DELETE SET NULL`).
Hosted `public.update_restaurant_memory` stamps `auth.uid()` into
`corrected_by` via UPDATE for confirmed / corrected / dismissed / forgotten /
disabled decisions.

Direct INSERTs could still mint those decision statuses with
`corrected_by = null`, leaving an unattributable manager decision.

## Change

- Domain: `validateRestaurantMemoryDecisionActorEvidence` →
  `missing_corrected_by` when status is a manager decision and actor is absent.
- Additive BEFORE INSERT tip only (no NOT NULL / CHECK).
- Active inserts remain allowed without `corrected_by`.
- Does not rewrite `update_restaurant_memory`.
- pgTAP plan = 11 (derived from assertion call sites).

## Alone-OK

Orthogonal to restaurant-memory locale / ASCII-C pins, #1298 mise-actions
decision actor, #1297 supplier-delivery verified_by, and inventory /
purchase-line actor tips.

## Verification

- `npm run typecheck` — passed
- focused restaurant-memory decision-actor suite — 4/4
- `npm test` — 680 passed / 0 fail / 7 cancelled (known `withTimeout` flaky suite; open #1183)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — Docker unavailable in this environment
