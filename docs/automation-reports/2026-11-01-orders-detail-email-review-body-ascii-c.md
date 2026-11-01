# MISE-005VF Orders detail email-review body ASCII C

Date: 2026-11-01

## Problem

Orders detail draft email review rendered the supplier email body with raw
truthiness before the intentional localized fallback:

```ts
visibleEmailPayload?.body || t("orders.detail.review.unavailable")
```

A Unicode-only-space body (`"\u2003"`) is raw-truthy while `.trim()` empties it,
so `orders.detail.review.unavailable` was bypassed and the panel could show a
blank-looking body. Unicode `.trim()` on padded bodies would invent a clean
display body.

## Change

- Add `services/domain/ordersDetailEmailReviewBodyIdentity.ts` with ASCII C
  multiline free-text prep (NBSP fold + C-end trim; preserve LF/TAB/CR; refuse
  em-space padding and disallowed controls).
- Route the email-review body display branch through soft
  `normalizeOrdersDetailEmailReviewBody` so unsafe tokens fall through to the
  localized fallback.
- Leave from/to/subject `??` rows, sent-note `#1013`, `#840` write/dirty-check,
  `generatedOrderMessage` trim, `#1010` delivery-evidence, and `#670` receive
  discrepancy alone.

## Inventing / bypass proof

- `Boolean("\u2003") === true` and `"\u2003" || FALLBACK !== FALLBACK`
  (fallback bypass).
- `"\u2003Please deliver before 10am\u2003".trim() === "Please deliver before 10am"`
  (Unicode-trim inventing).
- ASCII C soft-null restores `|| t("orders.detail.review.unavailable")`.

## Verification

- Focused `tests/ordersDetailEmailReviewBodyAsciiC.test.ts` — 5/5
- `npm run typecheck` — pass
- `npm run security:static` / `security:backend` — pass
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled
  (inherited `recalculationCycles`)

## Ownership

Owns Orders detail email-review body `orders.detail.review.unavailable`
presentation only. Alone-OK vs `#1013` (note.none), `#840` (write/dirty-check),
`#1010` (delivery-evidence timezone), and `#670` (receive discrepancy) on the
same file — different call sites/helpers.
