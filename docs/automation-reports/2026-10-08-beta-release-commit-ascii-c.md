# MISE-005KO: pin betaReleaseReadiness commit identity to ASCII C

## Summary

`normalizeCommit` in `services/domain/betaReleaseReadiness.ts` used Unicode-aware
`trim()` and `toLowerCase()` when comparing exact-commit release authority.
Unicode `trim()` strips NBSP / em-space / other Unicode spaces around an
otherwise-valid SHA, inventing a normalized candidate identity from padded
evidence and allowing that padded token to authorize the unpadded commit.

This tip pins commit identity to ASCII-only end trim and ASCII C case fold
(A–Z only), then fail-closes anything outside `[0-9a-fA-F]{40}` after that
trim. Non-hex Unicode folds such as Kelvin `K` → `k` remain rejected because
`k` is outside the hex alphabet.

## Scope

- Client domain `services/domain/betaReleaseReadiness.ts` (`normalizeCommit`)
- Focused static + behavioral tests
- Does **not** re-tip InventoryHealth display labels, `matchSupportedLocale`,
  error-message haystacks (`inventoryEventTransport` / `recalculationPorts`),
  operationalSignals cosmetic copy, or tipped fields through #717 / #709
- Does **not** rewrite `docs/launch/BETA_RELEASE_EVIDENCE.json` or go/no-go
  script receipts

## Verification

- `npm run typecheck`
- focused `tests/betaReleaseCommitAsciiC.test.ts` + `tests/betaReleaseReadiness.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This hardens exact-commit release authority
normalization; it does not unblock Apple signing, live POS credentials, or App
Store submission.
