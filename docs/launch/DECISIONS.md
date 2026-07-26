# Mise Launch Decisions

## Locked decisions

| Date | Decision |
| --- | --- |
| 2026-07-26 | Mise is a free, invite-only iOS app for restaurant organizations; commercial terms and Stripe invoices stay outside the app. |
| 2026-07-26 | Square is the first production POS. Other POS providers are deferred. |
| 2026-07-26 | Supplier ordering supports `off` and `draft_only`; every send requires an authenticated manager's explicit action. |
| 2026-07-26 | Inventory history is append-only. Corrections compensate for or supersede earlier events. |
| 2026-07-26 | Canonical inventory dimensions are grams, milliliters, and each. Pack conversions must be explicit and verified. |
| 2026-07-26 | Shadow forecasting requires 90% verified sales-volume coverage; operational drafting requires 95%, with a complete verified chain for every drafted line. |
| 2026-07-26 | AI can summarize or rank authoritative evidence but cannot create operational truth or block core workflows. |
| 2026-07-26 | `savings_share_bps` remains nullable and unset during the measurement pilot. Modeled savings are never billable. |
| 2026-07-26 | Local checkpoint commits are allowed; no push, merge, release, or production deployment occurs without Raymond's explicit approval. |
| 2026-07-26 | Account deletion is two-phase: plan without wiping access, delete Auth identity, then finalize tenant cleanup by durable audit ID. Auth failure leaves membership intact and retryable. |
| 2026-07-26 | Inventory-event actors are anonymized only by the Auth foreign-key action during account deletion; all operational event fields remain append-only. |

## Deferred decisions

- The eventual savings-share percentage.
- Additional POS and supplier-delivery providers.
- Autonomous supplier ordering.
- Non-US currencies, taxes, and App Store territories.
