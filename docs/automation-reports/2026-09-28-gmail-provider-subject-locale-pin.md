# MISE-005BD: gmail_credentials.provider_subject COLLATE C locale pin

Date: 2026-09-28
Branch: `cursor/mise-gmail-provider-subject-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the length-only CHECK on `private.gmail_credentials.provider_subject`
with an ASCII shape under COLLATE `"C"`:

```text
provider_subject collate "C" ~ '^[A-Za-z0-9_-]{1,255}$'
```

Fail-closed in Edge `gmail-oauth-callback` before `service_complete_gmail_oauth`
via local `GMAIL_PROVIDER_SUBJECT_PATTERN` / `isGmailProviderSubject`.

Does **not** rewrite `private.service_complete_gmail_oauth` or
`supabase/functions/_shared/gmail.ts` (open #423 owns those for sender_email).
A follow-up after #423 lands can pin the SQL writer + shared allowlist.

## Why

`provider_subject` is the durable Google account subject bound 1:1 to a
restaurant Gmail credential. Length-only storage plus Unicode-tolerant
`stringField("sub")` could accept identities that a restored C-locale path
would refuse (or the reverse), breaking reconnect continuity after dump/restore.

## Out of scope

- sender_email / complete-oauth rewrite (#423)
- OAuth state_hash / PKCE (#438)
- Square merchant_id (#460)
- activity_events / restaurant_memories / inventory_events (#375)

## Verification

- `npm run typecheck`
- focused: `gmailProviderSubjectLocalePin`
- `npm test`
- pgTAP fixture committed; not executed here when Docker unavailable

## Compose

Alone on main. Timestamp after MISE-005BC (#463). Prefer after #423 lands so a
follow-up can pin the complete-oauth writer gate to the same COLLATE C class.
