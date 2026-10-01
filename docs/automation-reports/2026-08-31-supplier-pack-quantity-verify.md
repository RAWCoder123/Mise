# Verified supplier pack quantity → recommendation rounding

Date: 2026-08-31  
Branch: `cursor/mise-supplier-pack-quantity-verify`  
Baseline: `origin/main` @ `20b28e5`

## Problem

`supplier_items` already stored numeric `pack_quantity` and `verification_status`, but:

- TypeScript ignored those fields (`pack_size` free-text only).
- Recommendation math used `Math.ceil(need)` only.
- No manager RPC/UI could verify catalog packs.
- Hosted planning snapshots did not carry verified packs into Edge signal generation.

Operators therefore received order quantities that did not match real case sizes.

## Solution

1. Domain helper `roundOrderQuantityToPack` + `resolveVerifiedPackQuantity` (verified packs only).
2. Wire pack rounding through `buildInventoryPrediction`, demo recommendation rebuild, and `calculateOperationalSignals`.
3. Additive migration:
   - `verify_supplier_item_pack_quantity` (manager+, audited, creates/links preferred catalog row).
   - planning snapshot `verifiedSupplierPacks` payload for Edge parity.
4. Repository + demo parity, inventory detail manager verify form, EN/ES/zh-Hans copy.
5. Demo seed links inventory items and verifies pack quantities for lbs/packs cases.

## Verification

- `npm run typecheck` — pass
- `npm test` — 640 pass / 0 fail / 7 cancelled (pre-existing)
- `npm run security:backend` — pass (expected; DEFINER RPC auth.uid/role gated, EXECUTE authenticated only)
- New unit/static coverage in `tests/supplierPackQuantity.test.ts`
- pgTAP source added at `supabase/tests/database/supplier_pack_quantity.test.sql` (Docker not available in this runner)

## Out of scope

- Inventing MOQ / lead_time / expiration columns
- Free-text `pack_size` as quantity authority
- Landing/rebasing open PR stacks #187–#290
- Invitee Auth bootstrap (founder-policy deferred)
