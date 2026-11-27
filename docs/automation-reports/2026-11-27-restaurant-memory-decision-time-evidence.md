# Restaurant-memory corrected_at INSERT evidence (2026-11-27)

## Gap

`restaurant_memories.corrected_at` is nullable because pre-decision `active`
learned-pattern inserts legitimately leave it null. Hosted
`public.update_restaurant_memory` stamps `corrected_at = now()` via UPDATE for
confirmed, corrected, dismissed, forgotten, and disabled decisions, but direct
inserts can still mint those decision statuses with `corrected_at = null` — a
manager decision that Activity / audit analysis cannot place in time.

## Change

- Domain: `validateRestaurantMemoryDecisionTimeEvidence` → `missing_corrected_at`
- Additive BEFORE INSERT tip only on `public.restaurant_memories`
- No NOT NULL / status-implies-timestamp CHECK (stays INSERT-only; orthogonal
  to companion corrected_by actor tip #1299)
- Does not rewrite `update_restaurant_memory`
- pgTAP plan = 10 (derived from assertion call sites)

## Alone-OK

Companion to #1299 (`corrected_by` only). Orthogonal to restaurant-memory
locale / ASCII-C pins and inventory / purchase-line / mise-action / activity /
audit / autonomy actor tips. Active inserts without `corrected_at` remain
allowed. Account-deletion anonymization clears `corrected_by` while preserving
`corrected_at`.

## Verification

- `npm run typecheck`
- focused `restaurantMemoryDecisionTimeEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
