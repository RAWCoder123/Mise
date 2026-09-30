# MISE-005DL: pin purchase_lines line_type/parse_confidence CHECKs to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-purchase-lines-line-type-parse-confidence-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `purchase_lines.line_type` and
`purchase_lines.parse_confidence` allowlists with exact-token contracts plus
ASCII shape under COLLATE `"C"`:

```sql
-- line_type
line_type in ('purchase', 'credit')
and line_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

-- parse_confidence
parse_confidence in ('confirmed', 'estimated', 'could_not_verify')
and parse_confidence collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (MISE-004C purchase line ledger create-table allowlists
and `ingest_purchase_lines` / `supersede_purchase_line` writers):

- `line_type`: `purchase` / `credit`
- `parse_confidence`: `confirmed` / `estimated` / `could_not_verify`

Exact-token allowlists are preserved; this tip adds the COLLATE C ASCII shape
gate alongside them.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins through #523
leave purchase_lines vocabulary on bare IN. Without a dedicated COLLATE C
shape CHECK, dump/restore under LC_CTYPE drift can accept direction or
confidence bytes the restored C-locale path would refuse — or the reverse —
breaking credit/purchase continuity and confidence ranking across restore.

## Scope

- CHECK-only on `public.purchase_lines.line_type` and
  `public.purchase_lines.parse_confidence`
- Does **not** rewrite ingest/supersede RPCs
- Does **not** touch `source`, `normalization_version`, `evidence_version`, or
  outreach `generation_provider`
- Alone on main OK; timestamp after #523 (`20260930260000`)

## Verification

- `npm run typecheck` pass
- focused `tests/purchaseLinesLineTypeParseConfidenceLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DL cases pass)
- pgTAP fixture committed (plan 21 from 21 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930260000_mise_005dl_purchase_lines_line_type_parse_confidence_locale_pin.sql`
- `supabase/tests/database/purchase_lines_line_type_parse_confidence_locale_pin.test.sql`
- `tests/purchaseLinesLineTypeParseConfidenceLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-purchase-lines-line-type-parse-confidence-locale-pin.md`
