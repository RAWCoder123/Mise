# Inventory correction note evidence (2026-11-26)

## Gap

`public.record_inventory_event` accepted `correction` rows with empty or
whitespace-only `metadata`. Product writers (#345 waste correction, #350 receipt
correction) already require a non-empty operator note and stamp it at
`metadata.note`. Without a hosted fail-closed rule, a manager JWT could move
on-hand under correction semantics with no comparable explanation of why the
repair happened.

## Change

- Domain `validateCorrectionEvidence` rejects missing/blank notes
  (`correction_requires_note`).
- Additive BEFORE INSERT trigger + NOT VALID CHECK on `inventory_events`.
- Transport maps the hosted `22023` message ahead of the generic evidence
  matcher so the device outbox settles terminally.
- pgTAP covers bare/whitespace rejects, noted accept + persistence,
  non-correction unconstrained, and direct-insert reject (plan=8).

## Alone-OK

Independent of correction-source allowlist (#1272), supersede linkage (#394),
exact-reverse (#395), usage/adjustment evidence (#396), waste/stockout reason
tips (#1270/#1271), and the purchase-line stack (#1238/#1250–#1258). Does not
touch contested UI / i18n / `miseValidation` paths.

## Verification

- `npm run typecheck`
- focused correction-note suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
