# MISE-005BN: sales_imports.source_file_name cntrl locale pin

Date: 2026-09-28  
Branch: `cursor/mise-sales-imports-source-file-name-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.sales_imports.source_file_name` was unbound nullable text. Square sync
writers leave it NULL; the open Manual CSV import tip (#265) also inserts NULL
today. The column remains the durable optional label for `csv_upload` /
file-backed import provenance on the sales-import ledger.

Under ctype drift, dump/restore can disagree on the same filename bytes —
accepting a row a restored C-locale gate would refuse (or the reverse),
breaking sales-import ledger continuity across restore. Sibling POS identity
and sync-cursor columns were pinned under COLLATE `"C"` by open MISE-005*
tips; `source_file_name` stayed unbound.

## Fix

Additive migration
`20260928130000_mise_005bn_sales_imports_source_file_name_locale_pin.sql`
adds `sales_imports_source_file_name_check`:

```sql
source_file_name is null
or (
  length(trim(source_file_name)) between 1 and 260
  and source_file_name collate "C" !~ '[[:cntrl:]]'
)
```

`length(trim(...))` 1–260 matches a basename / MAX_PATH-class bound and
rejects whitespace-only values (writers should store NULL instead of empty).

## Out of scope

- Does not rewrite Square sync SECURITY DEFINER writers
- Does not rewrite `import_manual_pos_sales` (#265)
- Does not rewrite `pos_integrations.sync_cursor` writers (#473 CHECK already
  gates the column)
- Does not touch `selected_modifier_ids`, inventory_events, activity_events, or
  restaurant_memories

## Compose

Compose-safe alone on main. Timestamp after MISE-005BM (#473). Prefer landing
after nearby POS / sync identity pins so restore continuity for sales-import
provenance is uniform; this tip does not depend on them. Compatible with #265
(writes NULL today).

## Verification

- `npm run typecheck` — pass
- focused `tests/salesImportsSourceFileNameLocalePin.test.ts` — 5/5
- `npm test` — 681 pass / 0 fail / 7 cancelled (withTimeout baseline)
- pgTAP fixture committed; not executed here when Docker unavailable
