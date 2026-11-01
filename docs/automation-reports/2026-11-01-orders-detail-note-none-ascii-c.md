# MISE-005VE: Orders detail note.none display ASCII C

Date: 2026-11-01  
Branch: `cursor/mise-orders-detail-note-none-ascii-c`

## Problem

Orders detail rendered sent supplier notes with raw truthiness before the
intentional localized fallback:

```ts
visibleOrder.operator_note || t("orders.detail.note.none")
```

A Unicode-only-space note (`"\u2003"`) is raw-truthy while `.trim()` empties it,
so the intentional `orders.detail.note.none` copy was bypassed and sent-order
chrome could show a blank-looking note. Separately, Unicode `.trim()` on padded
notes would invent a clean display body
(`"\u2003Call on arrival\u2003".trim() === "Call on arrival"`).

## Change

- Add `services/domain/ordersDetailNoteNoneIdentity.ts` with ASCII C multiline
  free-text prep (NBSP fold + C-end trim only; preserve internal LF/TAB/CR;
  refuse em-space padding and disallowed controls).
- Route the sent-note display branch in `app/orders/[id].tsx` through soft
  `normalizeOrdersDetailNoteNone` so unsafe tokens fall through to the
  intentional localized fallback.
- Leave write/persist / dirty-check (#840), `generatedOrderMessage` display
  trim, delivery-evidence timezone (#1010), email-review body unavailable
  fallback, and receive-discrepancy checklist (#670) alone.

## Inventing / bypass proof

- `Boolean("\u2003") === true` and `"\u2003" || "FALLBACK" !== "FALLBACK"`
  (fallback bypass).
- `"\u2003Call on arrival\u2003".trim() === "Call on arrival"` (Unicode-trim
  inventing).
- ASCII C soft-null restores `|| t("orders.detail.note.none")`.

## Verification

- Focused `tests/ordersDetailNoteNoneAsciiC.test.ts`
- `npm run typecheck`
- `npm test` (expect inherited recalculationCycles cancellations only)
