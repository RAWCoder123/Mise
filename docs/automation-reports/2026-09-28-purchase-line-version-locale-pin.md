# MISE-005BU: pin purchase-line version CHECKs to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-purchase-line-version-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Additive dedicated CHECKs on `public.purchase_lines`:

- `purchase_lines_normalization_version_check`
- `purchase_lines_evidence_version_check`

each requiring ASCII shape under COLLATE `"C"`:

```sql
col collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

Both columns remain NOT NULL; original bare equality allowlists from
MISE-004C are left in place.

## Writer vocabulary

Confirmed ASCII mint:

- `mise.purchase_line_normalization.v1` (normalization_version)
- `mise.purchase_line.v1` (evidence_version)

from MISE-004C ingest/append writers and
`services/domain/purchaseLines.ts`. Equality allowlists still own the exact
token; this tip only pins ASCII shape under COLLATE C.

## Why

MISE-004C version columns use bare equality without a dedicated COLLATE C
shape gate. MISE-005A proved locale drift on this cluster. Sibling tips
pinned currency (#446) and normalized_item_key (#477) on this table; version
identity columns remained unbound.

## Scope

- CHECK-only; does **not** rewrite currency (#446) or normalized_item_key
  (#477)
- Does **not** rewrite ingest / supersede / append RPCs
- Does **not** touch `purchase_decision_events.evidence_version` (next tip)
- Alone on main OK; timestamp after #480 (`20260928200000`)

## Verification

- `npm run typecheck`
- focused `tests/purchaseLineVersionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928200000_mise_005bu_purchase_line_version_locale_pin.sql`
- `supabase/tests/database/purchase_line_version_locale_pin.test.sql`
- `tests/purchaseLineVersionLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-purchase-line-version-locale-pin.md`
