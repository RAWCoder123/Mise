# MISE-005PI setup attachment label ASCII C identity prep (2026-10-13)

## Inventing proof

`saveRestaurantSetup` Unicode-trimmed attachment labels with soft-empty →
`"Setup reference"` (`attachment.label.trim() || "Setup reference"`). Em-space /
NBSP padding invented a clean durable setup reference
(`'\u2003Menu CSV\u2003'.trim() === 'Menu CSV'`). Soft-empty Unicode-only
padding also collapsed into the intentional default via `.trim()`.

ASCII C identity prep (ASCII end trim only; fail closed when Unicode trim would
still strip end padding) leaves em-space / NBSP alone and does not invent
equality with the unpadded label. Soft empty / Unicode-only spaces stay
soft-null so save can fall through to the prior `"Setup reference"` default
without inventing that default from a padded real token. Unicode-padded
non-empty tokens fail closed on the live normalize path.

## Change

- `services/domain/setupAttachmentLabelIdentity.ts`
- Route `saveRestaurantSetup` attachment labels via
  `normalizeCanonicalSetupAttachmentLabel` with soft-empty →
  `SETUP_ATTACHMENT_LABEL_DEFAULT`
- Left `normalizeSetupAttachment` (`asString` fallback), setupDrafts readiness
  emptiness, `requireRestaurantName`, and other setup draft field trims alone
- Complements open SQL cntrl pin #652 / MISE-005IJ without sharing its migration

## Verification

- focused AsciiC: 4/4 pass
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited withTimeout hang cancellations)
- Docker pgTAP unavailable in this environment

## Merge

Alone-OK. Keep module separate from open SQL label cntrl pin #652 / MISE-005IJ
and from restaurant-name inventing. When landing with #652, route
`requireSetupAttachmentLabel` through ASCII C prep and drop mutual
Unicode-trim cross-assertions.
