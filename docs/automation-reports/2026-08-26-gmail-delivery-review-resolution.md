# Gmail delivery review resolution (2026-08-26)

Fresh port of conflicting draft #133 onto current `main` after MISE-003B/003C.

## Closed
- Additive migration `20260826150000_supplier_email_delivery_review_resolution.sql`
- Authenticated read: `get_supplier_email_delivery_review` (no secrets/bodies)
- Manager resolve: `confirm_sent` | `allow_retry` with confirmation tokens
- Reclaim trigger clears resolution markers when failed → sending
- Order detail UI + EN/ES/zh-Hans; blocks send while review required
- Demo + hosted repository paths; audit events for both resolutions
- Confirm-sent honors claimed recommendation IDs when present (003C)

## Pins
- `tests/supplierEmailDeliveryReview.test.ts`
- `supabase/tests/database/supplier_email_delivery_review.test.sql`
- `docs/gmail-backend.md` review/resolution bullets

## Do not redo
- Auto-retrying `unknown` deliveries
- Granting resolve RPCs to service_role or anon
- Surfacing refresh tokens / message bodies in review reads
- Rewriting the full MISE-003C claim function for this gap
