# MISE-005BV: pin purchase-decision evidence_version CHECK to COLLATE C

Date: 2026-09-28
Branch: `cursor/mise-purchase-decision-evidence-version-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the auto-named bare-equality CHECK on
`public.purchase_decision_events.evidence_version` with equality plus ASCII
shape under COLLATE `"C"`:

```sql
evidence_version = 'mise.purchase_decision.v1'
and evidence_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

The column remains NOT NULL with default `mise.purchase_decision.v1`.

## Writer vocabulary

Confirmed ASCII mint:

- `mise.purchase_decision.v1` (column DEFAULT; writers omit the column)
- `PURCHASE_DECISION_EVIDENCE_VERSION` in
  `services/domain/purchaseDecisionMemory.ts`

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-004A used bare equality without a dedicated COLLATE C shape gate.
MISE-005A proved locale drift on this cluster. Sibling tip #481 pinned
`purchase_lines` versions the same way; `purchase_decision_events.evidence_version`
remained on bare equality only. Open #451/#416 own other columns on this
table and must not be rewritten here.

## Scope

- CHECK-only on `evidence_version`
- Does **not** rewrite `source_event_key` (#451) or unit cntrl (#416)
- Does **not** rewrite `record_purchase_decision_*` writers
- Does **not** touch `purchase_lines` versions (#481)
- Alone on main OK; timestamp after #481 (`20260928210000`)

## Verification

- `npm run typecheck`
- focused `tests/purchaseDecisionEvidenceVersionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260928210000_mise_005bv_purchase_decision_evidence_version_locale_pin.sql`
- `supabase/tests/database/purchase_decision_evidence_version_locale_pin.test.sql`
- `tests/purchaseDecisionEvidenceVersionLocalePin.test.ts`
- `docs/automation-reports/2026-09-28-purchase-decision-evidence-version-locale-pin.md`
