# MISE-005JX: pin Gmail sanitizeHeader trim to ASCII C

Date: 2026-10-07

## Problem

`sanitizeHeader` in `supabase/functions/_shared/gmail.ts` finished with Unicode
`String#trim()`. That drops NBSP, em-space, and other non-C whitespace from
subjects and Message-IDs (and from the bounded string that later feeds mailbox
normalization), inventing a header canonical form hosted COLLATE `"C"` email
paths would not treat as equal. MISE-005O (#423) retargets `normalizeEmail` /
sender mailbox fold only and deliberately leaves this trim alone.

## Change

- Export `trimAsciiCHeaderWhitespace` and `sanitizeGmailHeader` (MISE-005JX)
- Trim only C-locale `[[:space:]]` (space, tab, LF, VT, FF, CR)
- Keep CR/LF → space header-injection collapse before the trim
- Preserve NBSP and other non-C whitespace (email tip rule — do not fold NBSP)
- Private `sanitizeHeader` delegates only; no second Unicode trim
- Leave `normalizeEmail` on main’s Unicode `toLowerCase` path for #423

## Out of scope

- `#423` / MISE-005O Gmail sender_email + `normalizeEmail` fold (already tipped)
- `#425` supplierSendContent (already tipped)
- `#692` / `#691` supplier display-name tips (already tipped)
- `supplierRecipients` sort-key `toLocaleLowerCase` (optional later)
- Message-ID shape regex `\s` class (separate, lower priority)

## Verification

- `npm run typecheck`
- focused `tests/gmailSanitizeHeaderAsciiC.test.ts`
- `tests/gmailBackend.test.ts` (regression)
- `npm test`
- `npm run security:static`
- `npm run security:backend`
