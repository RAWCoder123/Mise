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
| 2026-07-28 | Manager feedback on deterministic findings is append-only and linked to the original evidence and policy version. Feedback may tune later suggestions but cannot rewrite evidence, inventory, safety limits, or ordering authority. |
| 2026-07-28 | Environment configuration never grants supplier-delivery authority by itself. The database must also permit Gmail delivery globally and for the restaurant while system mode is normal. All provider flags and ordering policy remain off for the August 3 beta. |
| 2026-07-28 | The beta privacy target is `https://getmise.app/privacy`; support and privacy contacts are `support@getmise.app` and `privacy@getmise.app`. In-app copy must continue to mark hosting and monitoring as pending until Raymond confirms both. |
| 2026-07-28 | Beta admission is admin-provisioned. Global Auth signup is disabled, email login remains enabled for invited users, anonymous admission is disabled, and only the service-role provisioning RPC may create a restaurant and initial owner membership. |
| 2026-07-28 | Beta owner invitations use a protected link created by trusted staging/production administration. Until monitored custom SMTP is configured, the link is delivered only through a Raymond-controlled external channel, stored in an owner-only temporary artifact, and never logged, committed, analyzed, or shown in support screenshots. |

## Deferred decisions

- The eventual savings-share percentage.
- Additional POS and supplier-delivery providers.
- Autonomous supplier ordering.
- Non-US currencies, taxes, and App Store territories.
