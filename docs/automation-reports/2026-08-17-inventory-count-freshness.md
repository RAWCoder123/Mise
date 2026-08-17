# Inventory count freshness and sale-time depletion (2026-08-17)

Branch: `cursor/mise-product-inspection-e1c9` @ `79fb31d`  
Baseline: `origin/main` @ `312c6f1`

## Gap closed

Pilot gap #1 from `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`:

- Verified count freshness is no longer confused with generic `inventory_items.last_updated`.
- Same-day POS depletion is anchored to the verified count timestamp so midday counts do not double-count morning usage.

## Implementation

- Domain helpers in `services/domain/inventoryCountFreshness.ts`
- `InventoryItem.last_counted_at` and `PosSale.sold_at`
- Migration `20260817090000_inventory_count_freshness_and_sale_time.sql`
  - projection stamps `last_counted_at` on count events
  - approved count sessions stamp every line (including zero-variance)
  - Square sync persists `sold_at`
- Square normalizer emits `sold_at` from order `closed_at`
- Prediction, operational signals, order automation, operating brief, and recommendation suppression consume verified count time
- Demo seed uses an opening count six hours before “now” so labeled demo depletion still runs

## Verification

- `npm run typecheck` — pass
- `npm test` — 510 pass / 0 fail / 7 pre-existing recalculation timeout cancels
- `npm run security:static` — pass
- `npm run security:backend` — pass

## Still open (next)

1. Enforce `buildPilotReadiness` at recommendation approval / draft generation
2. Provider catalog identity → verified menu/recipe mapping for consumption
3. Persist signal-refresh failure state after Square sales commit
4. Hosted/Docker pgTAP + staging provider proof (external)

## Classification

Controlled-pilot codebase; not yet first-restaurant pilot-ready. This slice removes an UNSAFE inventory freshness/depletion path but does not close the readiness-enforcement or provider-mapping gaps.
