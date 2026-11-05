# Verified supplier pack quantity → recommendation rounding (main rebase)

Date: 2026-11-05  
Branch: `cursor/mise-supplier-pack-quantity-verify-main-rebase`  
Baseline: `origin/main` @ `78da7376` (MISE-005A)  
Supersedes: stale **#291** (`cursor/mise-supplier-pack-quantity-verify` @ `d2872372`, base `20b28e50`)

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
3. Additive migration `20261105060000_verify_supplier_item_pack_quantity.sql` (renamed after MISE-004C so hosted tenants that already applied through `20260903120000` still receive the change):
   - `verify_supplier_item_pack_quantity` (manager+, audited, creates/links preferred catalog row).
   - planning snapshot `verifiedSupplierPacks` payload for Edge parity (additive on current `private.fetch_operational_planning_snapshot`).
4. Repository + demo parity, inventory detail manager verify form, EN/ES/zh-Hans copy.
5. Demo seed links inventory items and verifies pack quantities for lbs/packs cases.

## Land notes

- Do **not** merge stale #291; prefer this tip.
- Alone-OK beside open receive stacks #1100–#1105 (expect ordinary `i18n` / inventory-detail / demo merge conflicts on land).
- Does not invent MOQ / lead_time / expiration columns.
- Free-text `pack_size` remains display-only; only verified numeric packs round recommendations.

## Verification

- `npm run typecheck`
- `npm test` (focused `supplierPackQuantity` + full suite)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- pgTAP source at `supabase/tests/database/supplier_pack_quantity.test.sql` (Docker/hosted proof when available)

## Out of scope

- Landing open MERGEABLE stacks #1100–#1105 / #1099–#1088
- Invitee Auth bootstrap (founder-policy deferred)
- Live Square/Gmail credentials
