# MISE-005IK: restaurant_email_connections.sender_email locale pin

Date: 2026-10-05

## Change

Attach `restaurant_email_connections_sender_email_check` as null OR
length 3–254, trimmed, C-locale lower, ASCII C `[[:cntrl:]]` rejection, and
`[[:space:]]` mailbox shape under `COLLATE "C"` — matching the private Gmail
credential contract (MISE-005O) on the client-readable connection display
column.

CHECK-only; alone-OK vs provider (#523), status (#500), and Gmail credential /
OAuth writer tip (#423).

## Why

Foundation left `sender_email` as unbound nullable text. OAuth writers already
copy a normalized From from private credentials, but dump/restore had no
table-level mailbox gate under COLLATE C on the public connection row.

## Verification

- `npm run typecheck`
- focused `restaurantEmailConnectionsSenderEmailLocalePin`
- `npm test`
- pgTAP fixture committed; plan derived from assertion call sites
