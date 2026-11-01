# MISE-005VK Settings/Gmail sender_email ASCII C (2026-11-01)

- Branch: `cursor/mise-settings-gmail-sender-email-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

Settings Gmail connection detail rendered `sender_email` with nullish
coalescing before the intentional localized fallback:

```ts
visibleConnection?.sender_email ?? t("settings.gmail.status.notConnected")
```

A Unicode-only-space sender (`"\u2003"`) is non-nullish
(`("\u2003" ?? FALLBACK) === "\u2003"`), so `settings.gmail.status.notConnected`
was bypassed and the UI could render a blank-looking sender mailbox. Empty
string has the same `??` bypass. Separately, Unicode `.trim()` on padded
sender mailboxes
(`"\u2003orders@harbor.kitchen\u2003".trim() === "orders@harbor.kitchen"`)
would invent a clean display mailbox.

Open #1015 / MISE-005VG owns Orders detail email-review From/To/Subject only
and explicitly left Settings/Gmail `sender_email ??` alone. Open #966 owns
Settings account email labels only. Open #1018 anticipates this tip as
`presentationGmailSenderEmailIdentity` and Orders as
`presentationOrdersGmailSenderIdentity`. Mailbox tips preserve NBSP (no
fold).

## Change

- `services/domain/presentationGmailSenderEmailIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; leave
  `|| t("settings.gmail.status.notConnected")` to the call site.
- `app/settings/gmail.tsx` — route connection detail sender through
  `normalizeGmailSenderEmail`.
- Tests: `tests/settingsGmailSenderEmailAsciiC.test.ts` (5/5).
- Left Orders gmail connected-body sender (#candidate /
  presentationOrdersGmailSenderIdentity), Orders detail email-review
  headers (#1015), Settings account email (#966), waste itemName (#1018),
  Inventory detail item_name (#1017), Orders detail supplier_name (#1016),
  miseDomain hard-coded English `"Gmail ready"`, and DB COLLATE C
  sender_email shape pins (#423 / #653) alone.

## Verification

- focused `tests/settingsGmailSenderEmailAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +5 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1018 / #1017 / #1016 / #1015 / #1014 / #1013 / #966 / #959
- Re-tip this Settings/Gmail `sender_email ?? notConnected` row
- Tip Orders gmail connected-body sender as covered by this tip
