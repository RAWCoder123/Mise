# POS sync status contract clarification

Date: 2026-08-04  
Branch: `cursor/mise-product-inspection-0d95`

## Gap

`sync-pos-sales` used `provider_not_enabled` whenever provider secrets were present. That status overlapped with AI’s kill-switch language and understated the real fail-closed reason: live POS sync is not implemented yet. Operators and staging proofs could not distinguish missing server secrets from unimplemented capability.

## Fix

- Return `provider_not_implemented` (501) when the selected provider’s server secrets/config are present.
- Keep `server_configuration_required` (503) when secrets are missing.
- Leave `generate-ai-insights` on `provider_not_enabled` (feature kill-switch once `OPENAI_API_KEY` exists).
- Align client adapter scaffold errors and staging concurrency expectations.
- Pin the contract in `security-backend` and provider scaffold tests.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
