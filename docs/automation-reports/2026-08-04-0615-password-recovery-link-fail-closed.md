# Password recovery deep-link fail-closed

Date: 2026-08-04  
Branch: `cursor/mise-product-inspection-c643`

## Gap

When a recovery deep link failed (`exchangeCodeForSession` / `setSession`), `consumeAuthCallback` only logged telemetry. `passwordRecoveryPending` stayed false, so `/reset-password` silently redirected to login/setup/today with no operator-visible explanation.

## Fix

- Track `passwordRecoveryLinkError` on the session context when a recovery callback fails.
- Clear the flag on a successful recovery mark or via `clearPasswordRecoveryLinkError`.
- Login shows a localized StatusNotice (`resetLinkInvalid`) and clears the flag.
- Reset screen routes invalid-link cases back to login so the notice is visible.
- Add English / Spanish / Mandarin catalog copy.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

## Classification impact

Still controlled pilot-ready code pending Docker + hosted security re-proof.
