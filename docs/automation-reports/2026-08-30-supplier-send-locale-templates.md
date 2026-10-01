# Supplier-send locale templates (2026-08-30)

## Completed
- Froze `message_locale` (`en` | `es` | `zh-Hans`) on `supplier_orders`
- Localized fingerprinted supplier-send body/subject templates with demo TypeScript and hosted SQL parity
- New drafts inherit the actor `preferred_locale`; locale cannot flip under later draft edits
- Existing English drafts keep `message_locale = en` and remain fingerprint-valid

## Verification
- `npm run typecheck`
- `npm test` (focused supplier locale + full suite)
- `npm run security:static` when available

## Follow-ups
- Rebase onto #266 delivery_date message builder so localized delivery lines use structured dates
- Deploy additive migration to staging
