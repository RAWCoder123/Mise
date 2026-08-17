# Gmail unknown-delivery review resolution (2026-08-17)

## Completed
- Additive migration `20260817120000_supplier_email_delivery_review_resolution.sql`
  - `get_supplier_email_delivery_review` (authenticated, membership-gated, no secrets/bodies)
  - `resolve_supplier_email_delivery` with `confirm_sent` / `allow_retry` and explicit confirmation tokens
  - Claim reclaim clears resolution markers; unknown remains non-auto-retryable
- Domain + application + hosted/demo repository wiring
- Order detail review panel (EN/ES/ZH) that blocks approve-and-send while review is required
- Static tests + pgTAP privilege source

## Why
Ambiguous Gmail outcomes previously left orders stuck with no operator exit, blocking the supplier send loop.

## Still open
- Hosted/Docker pgTAP execution
- Live Gmail ambiguous-outcome proof
- Complementary pilot PRs #130/#131/#132
