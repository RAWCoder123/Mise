# MISE-005JY: pin Gmail Message-ID shape whitespace to ASCII C

Date: 2026-10-07

## Problem

`requireMessageId` in `supabase/functions/_shared/gmail.ts` validated the RFC
Message-ID angle-addr shape with Unicode `\s`. That class treats NBSP, em-space,
and other non-C whitespace as separators, inventing rejections that hosted
COLLATE `"C"` `[[:space:]]` preflights would not mirror. MISE-005JX (#693) pins
`sanitizeHeader` trim only and deliberately leaves this shape class alone.

## Change

- Export `isAsciiCGmailRfcMessageIdShape` (MISE-005JY)
- Replace Unicode `\s` with the C-locale whitespace set: space, tab, LF, VT, FF, CR
- Keep `requireMessageId` as the private gate used by `buildGmailRawMessage`
- Do not retarget `sanitizeHeader` or `normalizeEmail` (#693 / #423)

## Out of scope

- `#693` / MISE-005JX Gmail `sanitizeHeader` ASCII C trim (already tipped)
- `#423` / MISE-005O Gmail `normalizeEmail` / sender mailbox fold (already tipped)
- `#427` / MISE-005S claim RFC Message-Id cntrl preflight (SQL, already tipped)
- `supplierRecipients` sort-key `toLocaleLowerCase` (optional later; rebase with #692)
- UI search needles (`scan-item`, `inventory`, `log-delivery`)

## Verification

- `npm run typecheck`
- focused `tests/gmailMessageIdShapeAsciiC.test.ts`
- `tests/gmailBackend.test.ts` (regression)
- `npm test`
- `npm run security:static`
- `npm run security:backend`
