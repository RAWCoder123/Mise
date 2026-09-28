# MISE-005BQ: purchase_lines.normalized_item_key cntrl locale pin

Date: 2026-09-28  
Branch: `cursor/mise-purchase-line-normalized-item-key-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.purchase_lines.normalized_item_key` was length-only (1–500) with no
control-character gate. MISE-005A pinned `normalize_purchase_item_key` to
COLLATE `"C"`, and `purchase_lines_normalized_key_check` still requires the
stored key to equal `normalize(raw_item_description)`. Open MISE-005F (#414)
reattached cntrl COLLATE `"C"` on the four sibling text fields but left
`normalized_item_key` on the length-only inline CHECK.

`normalized_item_key` is the durable machine identity for purchase-line
netting and indexes. Under ctype drift, dump/restore can disagree on whether
stored key bytes are acceptable while the append-only ledger cannot be
rewritten in place.

## Fix

Additive migration
`20260928160000_mise_005bq_purchase_line_normalized_item_key_locale_pin.sql`
replaces the length-only shape CHECK with
`purchase_lines_normalized_item_key_check`:

```sql
normalized_item_key is null
or (
  length(normalized_item_key) between 1 and 500
  and normalized_item_key collate "C" !~ '[[:cntrl:]]'
)
```

The drop loop explicitly preserves `purchase_lines_normalized_key_check`
(normalize equality).

## Out of scope

- Does not rewrite `normalize_purchase_item_key` / fold helpers (already
  MISE-005A)
- Does not rewrite `purchase_line_text` / `purchase_line_has_control_characters`
  (#414)
- Does not rewrite `ingest_purchase_lines` / `append_purchase_line`
  (#397/#398/#415)
- Does not reattach the four text CHECKs owned by #414
- Does not touch currency (#446), activity_events, inventory_events, or
  restaurant_memories

## Compose

Compose-safe alone on main. Timestamp after MISE-005BP (#476). Prefer landing
alongside #414 so purchase_lines text identity is uniformly COLLATE `"C"`;
this tip does not depend on #414.

## Verification

- `npm run typecheck`
- focused `tests/purchaseLineNormalizedItemKeyLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here when Docker unavailable
