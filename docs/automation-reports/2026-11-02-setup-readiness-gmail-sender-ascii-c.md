# MISE-005VW setup-readiness Email sender_email ASCII C (2026-11-02)

- Branch: `cursor/mise-setup-readiness-gmail-sender-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing / bypass proof

`buildSetupReadinessSummary` decided Email missing/complete and selected detail
text with a raw truthy / nullish-coalescing gate:

```ts
const missingEmailSender =
  emailConnection?.status !== "connected" || !emailConnection.sender_email;
detail: missingEmailSender
  ? "Gmail sender not linked"
  : emailConnection.sender_email ?? "Gmail ready";
```

A Unicode-only-space sender (`"\u2003"`) is truthy under
`!emailConnection.sender_email` and non-nullish under `??`, so a connected Gmail
row with only padding was marked complete and rendered the padding (bypassing
the intentional hard-coded `"Gmail ready"` empty-state) instead of failing
closed to `"Gmail sender not linked"`. Empty string has the same `??` bypass if
it ever reached the complete branch. Separately, Unicode `.trim()` on padded
sender mailboxes
(`"\u2003orders@harbor.kitchen\u2003".trim() === "orders@harbor.kitchen"`)
would invent a clean setup-readiness mailbox identity.

Open #1019 / MISE-005VK owns Settings/Gmail `sender_email` display only and
explicitly left miseDomain hard-coded `"Gmail ready"` / `"Gmail sender not
linked"` alone. Open #1020 owns Orders gmail connected-body sender. Mailbox
tips preserve NBSP (no fold).

## Change

- `services/domain/presentationSetupReadinessGmailSenderIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string; leave
  `"Gmail sender not linked"` / `"Gmail ready"` to the call site.
- `services/domain/miseDomain.ts` — route setup-readiness Email sender through
  `normalizeSetupReadinessGmailSender` before the missing gate and detail
  `?? "Gmail ready"` row.
- Tests: `tests/setupReadinessGmailSenderAsciiC.test.ts` (6/6).
- Left Settings/Gmail display (#1019), Orders gmail connected-body (#1020),
  Orders detail email-review headers (#1015), Settings account email (#966),
  `buildSupplierEmailPayload` `from` pass-through, pilot-readiness
  `sender_email?.trim()` gating, and DB COLLATE C sender_email shape pins
  (#423 / #653) alone.

## Verification

- focused `tests/setupReadinessGmailSenderAsciiC.test.ts`: 6/6
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 689 total / 682 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles`); tip +6 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #1030 / #1029 / #1020 / #1019 / #1015 / #966 / #959
- Re-tip this setup-readiness Email `sender_email` missing/detail gate
- Tip Settings/Gmail `sender_email ?? notConnected` as covered by this tip
