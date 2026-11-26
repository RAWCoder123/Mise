# Inventory other-reason note evidence (2026-11-26)

Date: 2026-11-26  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-other-reason-note-evidence-main`

## Gap

`public.record_inventory_event` accepted waste and stockout with
`reason_code = 'other'` and empty or whitespace-only `metadata.note`. Named
reason codes are comparable on their own; the catch-all `other` code is not.
A manager JWT could therefore rewrite on-hand under waste/stockout semantics
with no comparable explanation of what "other" meant.

## Change

- Domain: `inventoryOtherReasonNoteEvidence.ts` requires a non-empty trimmed
  `metadata.note` only when `event_type` is `waste` or `stockout` and
  `reason_code` is exactly `other`. Rejects `waste_other_requires_note` /
  `stockout_other_requires_note`. Named reasons stay note-optional.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_other_reason_note_evidence` with the same rule.
- NOT VALID CHECK skips legacy rows; new inserts still fail closed via the
  trigger.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=10 from assertion call sites: bare/blank rejects, noted accept +
  persistence, stockout noted accept, named reason unconstrained, non-target
  unconstrained, and direct-insert reject.

## Alone-OK

Orthogonal to waste/stockout source allowlists (#1265 / #1266), full reason
allowlists (#1270 / #1271), correction note/reason (#1273 / #1274),
usage/adjustment evidence (#396), and purchase-line #1238/#1250–#1258.

Contested merge note: after #1270 / #1271 land, their “accept each allowlisted
reason” loops must stamp a note when the code is `other`. UI reason pickers
(#301 / #1098 / #366) still treat notes as optional for named reasons; a
follow-up UI tip should require a note when the operator picks Other.

Does not touch `app/inventory/[id].tsx`, `i18n/catalog.ts`, or
`miseValidation.ts`.

## Verification

- `npm run typecheck`
- focused other-reason note suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test` — not run in this environment
