# MISE-005VG Orders detail email-review from/to/subject ASCII C (2026-11-01)

- Branch: `cursor/mise-orders-detail-email-review-header-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

Orders detail draft email review rendered From / To / Subject with nullish
coalescing before the intentional localized fallback:

```ts
visibleEmailPayload?.from ?? t("orders.detail.review.unavailable")
```

(and the matching `to` / `subject` rows).

A Unicode-only-space header (`"\u2003"`) is non-nullish
(`("\u2003" ?? FALLBACK) === "\u2003"`), so `orders.detail.review.unavailable`
was bypassed and the review panel could render a blank-looking header row.
Empty string has the same `??` bypass. Separately, Unicode `.trim()` on padded
mailbox / subject headers
(`"\u2003chef@harbor.kitchen\u2003".trim() === "chef@harbor.kitchen"`) would
invent a clean display header.

Open #1014 / MISE-005VF owns email-review body only and explicitly left
from/to/subject `??` rows alone. Mailbox/header tips preserve NBSP (no fold).

## Change

- `services/domain/ordersDetailEmailReviewHeaderIdentity.ts` — ASCII end trim
  only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("orders.detail.review.unavailable")` to the call sites.
- `app/orders/[id].tsx` — route From / To / Subject review rows through
  `normalizeOrdersDetailEmailReviewHeader`.
- Tests: `tests/ordersDetailEmailReviewHeaderAsciiC.test.ts` (5/5).
- Left email-review body (#1014), note.none (#1013), operator_note (#840),
  durable send From/To (#708), durable send subject (#913), delivery-evidence
  (#1010), and receive-discrepancy (#670) alone.

## Verification

- focused `tests/ordersDetailEmailReviewHeaderAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +5 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1014 / #1013 / #840 / #708 / #913 / #966 / #959 / #1010 /
  #670
- Re-tip these From / To / Subject review header rows
- Tip email-review body, note.none, or durable supplier-send identity as
  covered by this tip
