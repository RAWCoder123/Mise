# MISE-005UH supplier draft line label ASCII C (2026-10-30)

- Branch: `cursor/mise-supplier-draft-line-label-ascii-c`
- Base: `origin/main` @ `78da737`

## Inventing proof

`utils/orderPresentation` scanned supplier order messages with
`boundedMessage.slice(...).replace(/\r$/, "").trim()` and then
`match?.[1]?.trim()` / `match?.[2]?.trim()` before storing `itemName` and
`quantityLabel` presentation chrome. Unicode `.trim()` stripped em-space /
NBSP padding, so `'\u2003Roma Tomatoes\u2003'.trim()` invented a clean item
name, `'\u200320 lb\u2003'.trim()` invented a clean quantity label, and
`'\u2003Roma Tomatoes - 20 lb\u2003'.trim()` invented a clean draft line
before capture.

Not owned by open #971 (Login email chip), #970 (Insights cuisine-type),
#969 (Insights restaurant-name), #968 (Today title restaurant-name),
#967 (branding initials), #966 (Settings account email), #965 (Team
directory), #964 (profile name), #963 (Create Task assignee), MISE-005A
(`normalize_purchase_item_key`), or `miseValidation` supplier-send
`itemName` validation.

## Change

- `services/domain/presentationSupplierDraftLineIdentity.ts` — ASCII end
  trim only; soft-null on Unicode padding / controls / non-string for draft
  line, item name, and quantity label tokens.
- `utils/orderPresentation.ts` — route raw-line and capture-group prep
  through the identity helpers; skip soft-nulled lines instead of inventing
  clean chrome.
- Tests: `tests/presentationSupplierDraftLineAsciiC.test.ts` (3/3).

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- focused supplier draft line ASCII C tests: 3/3
- `npm test`: 686 total / 679 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +3 vs main ~683
- Docker pgTAP unavailable in this environment

## Do not

- Share module with #971 / #970 / #969 / #968 / #967 / #966 / #965 / #964 /
  #963 / MISE-005A / miseValidation supplier-send itemName
- Re-tip this supplier draft line itemName/quantityLabel field
- Tip Login / Insights / Today / branding / Settings / Team / Create Task
  labels as covered by this tip
