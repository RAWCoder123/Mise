# MISE-005DN: pin purchase_lines.source CHECK to COLLATE C

Date: 2026-09-30
Branch: `cursor/mise-purchase-lines-source-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `purchase_lines.source` allowlist with an exact-token
contract plus ASCII shape under COLLATE `"C"`:

```sql
source in ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo')
and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (MISE-004C purchase line ledger create-table allowlist
and `ingest_purchase_lines` writer):

- `invoice`
- `order_confirmation`
- `manual_entry`
- `credit_memo`

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins through #525
leave `purchase_lines.source` on bare IN. Without a dedicated COLLATE C shape
CHECK, dump/restore under LC_CTYPE drift can accept document-source bytes the
restored C-locale path would refuse — or the reverse — breaking purchase-line
document provenance and idempotency continuity across restore.

## Scope

- CHECK-only on `public.purchase_lines.source`
- Does **not** rewrite ingest/supersede RPCs
- Does **not** touch `line_type`, `parse_confidence`, `normalization_version`,
  `evidence_version`, or outreach `generation_provider`
- Alone on main OK; timestamp after #525 (`20260930280000`)

## Verification

- `npm run typecheck` pass
- focused `tests/purchaseLinesSourceLocalePin.test.ts` 3/3 pass
- `npm test` 679 pass / 0 fail / 7 cancelled (inherited cancelledByParent noise; new
  MISE-005DN cases pass)
- pgTAP fixture committed (plan 15 from 15 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260930280000_mise_005dn_purchase_lines_source_locale_pin.sql`
- `supabase/tests/database/purchase_lines_source_locale_pin.test.sql`
- `tests/purchaseLinesSourceLocalePin.test.ts`
- `docs/automation-reports/2026-09-30-purchase-lines-source-locale-pin.md`
