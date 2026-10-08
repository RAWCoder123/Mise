# MISE-005KP: pin Edge requireUuid identity to ASCII C

## Summary

`requireUuid` in `supabase/functions/_shared/mise.ts` used Unicode-aware
`requireString(...).trim()` and `toLowerCase()` when canonicalizing Edge UUID
identities (`restaurantId`, `orderId`, session IDs, and related RPC inputs).
Unicode `trim()` strips NBSP / em-space / other Unicode spaces around an
otherwise-valid UUID, inventing a normalized identity from padded input and
allowing that padded token to authorize the unpadded UUID.

This tip pins UUID identity to ASCII-only end trim and ASCII C case fold
(A–Z only), then fail-closes anything outside the ASCII hex UUID shape after
that trim. Non-hex Unicode folds such as Kelvin `K` → `k` remain rejected
because `k` is outside the hex alphabet.

Pure helpers live in `supabase/functions/_shared/uuidIdentity.ts` so Node tests
can import them without loading Deno `npm:` dependencies from `mise.ts`.

## Scope

- Edge shared `requireUuid` + `uuidIdentity.ts` helpers (MISE-005KP)
- Focused static + behavioral tests
- Does **not** re-tip outreach-agent's local `requireUuid`, Edge
  `isCanonicalEmail` reject-non-lower, #706 secret scrubbers, #718
  betaReleaseReadiness, InventoryHealth display labels, `matchSupportedLocale`,
  or error-message haystacks (`inventoryEventTransport` / `recalculationPorts`)

## Verification

- `npm run typecheck`
- focused `tests/edgeRequireUuidAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Product note

Controlled pilot-ready codebase. This hardens Edge UUID request identity
normalization; it does not unblock Apple signing, live POS credentials, or App
Store submission.
