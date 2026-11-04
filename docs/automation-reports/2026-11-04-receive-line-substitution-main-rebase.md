# Receive-line substitution main rebase (2026-11-04)

## Why
Open #293 (`cursor/mise-receive-line-substitution` @ `b7736c8b`) still closed a
real inventory gap: hosted `record_supplier_delivery` already credited verified
same-unit substitutes, but the client always sent `substitutionInventoryItemId:
null`. The draft was MERGEABLE but two commits behind `origin/main` at
`78da7376` (MISE-004C + MISE-005A).

## What
Cherry-picked `b7736c8b` onto current `origin/main` as
`cursor/mise-receive-line-substitution-main-rebase`. Auto-merge of demo and
hosted repository files was clean; no migration required.

## Verification on this tip
- `npm run typecheck` passed
- Focused substitution tests 6/6 passed
- `npm test` — 689 total / 682 pass / 0 fail / 7 cancelled (pre-existing
  recalculationCycles withTimeout cancellations)
- `npm run security:static` and `npm run security:backend` passed

## Supersedes
Open #293 once this tip lands. Do not re-tip receive-line substitution after
merge.
