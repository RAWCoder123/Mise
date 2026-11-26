# Inventory source slug evidence

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-inventory-source-slug-evidence-main`

## Gap

`public.inventory_events.source` is required and length-bounded (1–80 after
trim), but shape is free-form on current main. A manager JWT can mint spaces,
mixed case, punctuation, or padded labels onto the append-only ledger and
rewrite on-hand without comparable Activity / write-path provenance. Product
writers already stamp lowercase snake_case sources
(`operator_receipt`, `supplier_delivery`, `approve_count_session`, …).

## Change

- Domain: `invalid_source_shape` via `validateSourceSlugEvidence`
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_source_slug_evidence` requiring
  `^[a-z0-9_]{3,80}$`
- NOT VALID CHECK mirrors the same shape without rewriting history
- Transport maps hosted `22023` messages ahead of the generic evidence matcher
- pgTAP plan=10 from assertion call sites (spaced/case/short/hyphen/padded
  rejects, slug + `operator_receipt` accept, direct-insert reject)

## Alone-OK

Orthogonal to reason-code slug #1279, actor_user_id #1280, transfer
location/quantity #1277/#1278, reason/source allowlists #1259–#1276,
other-reason notes #1275, evidence bounds #1261, and purchase-line
#1238/#1250–#1258. Does not rewrite `record_inventory_event` or
`reject_inventory_event_mutation`.

Contested merge: case-variant / spaced fixtures in source allowlist tips may
hit this slug guard first once both land (error message differs; allowlists
still cover valid-slug tokens that are not on the allowlist).

## Verification

- `npm run typecheck` — passed
- focused source-slug suite — 8/8 passed
- `npm test` — 684 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
