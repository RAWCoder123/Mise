# MISE-005VL Orders Gmail connected-body sender_email ASCII C (2026-11-01)

- Branch: `cursor/mise-orders-gmail-sender-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

Orders hub Gmail connected-body rendered `sender_email` with nullish
coalescing before the intentional localized fallback:

```ts
visibleEmailConnection?.sender_email ?? t("orders.gmail.connected.fallbackSender")
```

A Unicode-only-space sender (`"\u2003"`) is non-nullish
(`("\u2003" ?? FALLBACK) === "\u2003"`), so `orders.gmail.connected.fallbackSender`
was bypassed and the UI could interpolate a blank-looking sender mailbox into
`orders.gmail.connected.body`. Empty string has the same `??` bypass.
Separately, Unicode `.trim()` on padded sender mailboxes
(`"\u2003orders@harbor.kitchen\u2003".trim() === "orders@harbor.kitchen"`)
would invent a clean display mailbox.

Open #1019 / MISE-005VK owns Settings/Gmail `sender_email ?? notConnected`
only and explicitly left Orders gmail connected-body sender alone. Open #1015
owns Orders detail email-review From/To/Subject only. Open #966 owns Settings
account email labels only. Mailbox tips preserve NBSP (no fold).

## Change

- `services/domain/presentationOrdersGmailSenderIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("orders.gmail.connected.fallbackSender")` to the call site.
- `app/(tabs)/orders.tsx` — route connected-body sender through
  `normalizeOrdersGmailSenderEmail`.
- Tests: `tests/ordersGmailSenderEmailAsciiC.test.ts` (5/5).
- Left Settings/Gmail sender_email (#1019 /
  presentationGmailSenderEmailIdentity), Orders detail email-review
  headers (#1015), Settings account email (#966), waste itemName (#1018),
  Inventory detail item_name (#1017), Orders detail supplier_name (#1016),
  miseDomain hard-coded English `"Gmail ready"`, and DB COLLATE C
  sender_email shape pins (#423 / #653) alone.

## Verification

- focused `tests/ordersGmailSenderEmailAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +5 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1019 / #1018 / #1017 / #1016 / #1015 / #1014 / #1013 / #966 / #959
- Re-tip this Orders gmail connected-body `sender_email ?? fallbackSender` row
- Tip Settings/Gmail `sender_email ?? notConnected` as covered by this tip
