# MISE-005PM generatedOrderMessage Notes: ASCII C prep (2026-10-14)

- Branch: `cursor/mise-generated-order-message-ascii-c` @ `301c3c5c`
- PR: #847
- Base: `origin/main` @ `78da737`

## Inventing proof

Orders UI `generatedOrderMessage` Unicode-trimmed `operator_note` before building
the `\n\nNotes:\n` suffix used to strip notes from `order_message` for display.
`buildSupplierOrderMessage` Unicode-trimmed the same note before appending that
suffix. Em-space / NBSP padding invented a clean free-text body
(`'\u2003Call on arrival\u2003'.trim() === 'Call on arrival'`). The invented
clean suffix then failed to match a message that still carried the raw padded
note, so the display path could not strip Notes: correctly.

ASCII C multiline free-text prep (NBSP fold + C-end trim only; preserve internal
LF/TAB/CR) leaves em-space alone and does not invent equality with the unpadded
note. Soft empty / Unicode-only spaces stay soft-null.

## Change

- `services/domain/generatedOrderMessageIdentity.ts`
- Route `generatedOrderMessage` display strip and `buildSupplierOrderMessage`
  Notes: append through `canonicalizeOrderMessageNote`
- Left `requireSupplierOperatorNote` / orders UI persist / demo patch trim
  (#840), count-line note tips (#827 / #846), count-session note (#845),
  restaurant-memory statement (#830), and user profile display-name trim alone

## Verification

- focused AsciiC 6/6
- `npm run typecheck` pass
- `npm run security:static` / `npm run security:backend` pass
- `npm test` 689 total / 689 pass / 0 fail
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK with #840. Keep module separate from `supplierOperatorNoteIdentity.ts`.
When landing with #840, drop any assertion from this tip that orders UI still
uses `operator_note: operatorNote.trim() || null` once #840 routes persist
through ASCII C canonicalize. Prefer sharing one Notes-note canonicalize only
after both tips land, not by rewriting #840 in this tip.
