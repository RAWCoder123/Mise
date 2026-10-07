# MISE-005KG: pin settings account deleteConfirmWord identity to ASCII C

## Summary

`app/(tabs)/settings.tsx` gated the irreversible account-deletion control with
Unicode-aware `trim` / `toLowerCase` on the typed confirmation word versus the
locale catalog string (`DELETE` / `ELIMINAR` / `删除`). Under Unicode trim, NBSP /
em-space / BOM padding around the expected word is stripped, inventing a
confirmation match that enables the delete button. `removeAccount` also did not
re-check the confirmation word before calling `deleteAccount`.

This tip moves confirmation identity into
`services/domain/accountDeletionConfirmIdentity.ts` with ASCII C case fold and
ASCII-only end trim, wires the Settings disable gate through that helper, and
re-validates inside `removeAccount` so button state alone cannot authorize
deletion.

## Scope

- Client domain helper `accountDeletionConfirmIdentity.ts`
  (`normalizeAccountDeletionConfirmToken`, `matchesAccountDeletionConfirmWord`)
- Wire `app/(tabs)/settings.tsx` deleteConfirm disabled gate + `removeAccount`
  fail-closed re-check
- Focused static + behavioral tests
- Does **not** re-tip Inventory categoryIcon (#701), Ask Mise intent (#700),
  restaurantMemory learning-signal (#699), typed-search tips (#697/#698), or
  other free-form/display-only lowercasing paths (insights labels, demo price
  heuristics, error-message haystacks)
- Does **not** rewrite SQL uniqueness / CHECK migrations or account-deletion
  Edge/RPC contracts

## Verification

- `npm run typecheck`
- focused `tests/accountDeletionConfirmIdentityAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This closes the settings deleteConfirmWord
Unicode-trim inventing gap explicitly deferred by #701; it does not unblock live
POS credentials or App Store submission.
