# Inventory transfer location evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-transfer-location-evidence-main`

## Gap

`public.record_inventory_event` accepted any `p_metadata` (including `{}`) for
`event_type = 'transfer'`. The only production transfer write path
(PR #1100 `transfer_inventory`) stamps distinct UUID
`metadata.from_storage_location_id` / `metadata.to_storage_location_id`. A
manager JWT could therefore mint `transfer` + empty / partial / `"Main"` /
same-id metadata, move on-hand under today's non-specialized projection
(additive `else` branch), raise operational Activity, and forge Activity /
history station provenance.

## Change

- Domain: reject `transfer_requires_locations` / `invalid_transfer_locations`
  unless metadata carries two distinct UUID from/to storage location ids.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_transfer_location_evidence` with the same rule,
  plus a NOT VALID CHECK that skips legacy rows.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=9 from assertion call sites: missing/partial/garbage/same-id
  rejects, matching accept, non-transfer unconstrained, and direct-insert
  reject.

## Alone-OK

Orthogonal to transfer-source allowlist #1269 (accepts `transfer_inventory`
source), transfer-reason #1276 (accepts `station_transfer`; this tip only
gates location metadata), storage-transfer productization #1100/#215 (stamps
the same from/to keys; this guard accepts that shape without creating
`storage_locations` or FK-checking them), waste/stockout/correction reason
tips, and purchase-line #1238/#1250–#1258. Contested merge: #1276 / #1269
accept fixtures that mint transfer with `metadata: {}` need distinct UUID
from/to location ids once this tip lands.

## Verification

- `npm run typecheck` — passed
- focused transfer-location suite — 8/8 passed
- `npm test` — 684 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
