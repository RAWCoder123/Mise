# MISE-005JZ: pin supplier recipient directory sort key to ASCII C

## Summary

`services/domain/supplierRecipients.ts` still folded supplier directory sort
keys with Unicode-aware `toLocaleLowerCase("en-US")`. Sibling client tips
already pin supplier display-name prep (#692), supplier-recipient email
(#681/#690), demo supplier identity (#410), and other identity folds to ASCII
C, and hosted helpers fold under SQL `lower(... collate "C")`. Under Unicode
case folding, a Kelvin sign (`K`) becomes `k`, which invents a directory sort
collision with ordinary `K` suppliers.

This tip replaces the sort-key fold with ASCII C case fold (A-Z only). Display
name presentation prep remains owned by open #692; this change only touches
`supplierKey`.

## Scope

- Client domain change in `supplierRecipients.ts` (`supplierKey` / `asciiCLower`)
- Focused static + behavioral tests
- Does **not** re-tip supplier display-name validation (#692), suppliers-settings
  display-name (#691), suppliers-settings draft-email (#690), supplier-recipient
  email client normalize (#681), demoSupplierIdentity (#410), Gmail Message-ID
  shape (#694), or Gmail sanitizeHeader (#693)
- Does **not** rewrite SQL uniqueness / CHECK migrations
- Does **not** change durable supplier identity binding (IDs remain authority)

## Verification

- `npm run typecheck`
- focused `tests/supplierRecipientsSortKeyAsciiC.test.ts` + `tests/supplierRecipients.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes a supplier-directory sort-key
identity parity gap; it does not unblock live POS/Gmail credentials or App
Store submission.
