# MISE-005XI: Orders detail approveAndSend a11y recipient ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-orders-detail-action-recipient-ascii-c`

## Problem

Orders detail always passed raw `visibleEmailPayload?.to` (or empty string via
`?? ""`) into the approve-and-send accessibility `recipient` interpolation.
Empty and Unicode-only-space mailboxes are non-nullish / truthy enough to bypass
that empty fallback, so VoiceOver / TalkBack labels could include blank-looking
recipient identity with no intentional localized none marker. Unicode `.trim()`
on padded mailboxes would invent a clean recipient label before interpolation.

## Change

- Add `normalizeOrdersDetailActionRecipient` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold).
- Route the approveAndSend a11y `recipient` interpolation through soft-null
  before `|| t("orders.detail.action.recipient.none")`.
- Add EN / ES / zh-Hans `orders.detail.action.recipient.none`.
- Focused inventing / bypass proofs in
  `tests/ordersDetailActionRecipientAsciiC.test.ts`.

## Ownership

Owns only Orders detail approveAndSend a11y `recipient` →
`orders.detail.action.recipient.none` presentation. Does **not** own
email-review From / To / Subject (#1015), email-review body (#1014), note.none
(#1013), operator_note (#840), durable send From/To (#708), durable send
subject (#913), Settings suppliers recipient-email (#1032), supplier-recipient
email client normalize (#681), Orders detail action a11y supplier_name (#1068),
Orders detail Screen title supplier_name (#1016), or receive-discrepancy
(#670).

Alone-OK relative to #1015 / #1068 / #1032 / #681 (different call sites /
helpers / fallbacks).

## Verification

- focused tip tests: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited `recalculationCycles`)
- Docker pgTAP unavailable in this environment
