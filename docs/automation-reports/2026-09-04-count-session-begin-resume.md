# Count session begin-or-resume (2026-09-04)

## Problem

Starting an inventory count while a session is already `in_progress` or
`submitted` raised `A count session is already open for this restaurant`.

- The Start count screen surfaced the raw error (or a misleading canonical-unit
  start error) instead of resuming the open sheet.
- Hosted `operational-workflows` wrapped the Postgres unique-open guard as a
  generic 500 `Unexpected function error.`, so clients could not detect the race.
- Multi-device or stale-UI Start presses left operators stuck off the open session.

## Fix

- Application `beginOrResumeInventoryCountSession` returns the open session when
  one already exists, including after a begin race.
- Count UI uses that helper, restores draft lines via `syncDraftsFromDetail`, and
  shows EN/ES/zh-Hans resumed vs started notices without raw error text.
- Edge maps the open-session RPC race to HTTP 409 with the operator-facing message.
- Demo begin is idempotent and returns the existing open session.

## Verification

- `npm run typecheck`
- focused resume / domain / security pins
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

## Notes

- No migration. Distinct from scoped counts (#358), count history (#290), and
  opening notes (#300).
- Does not invent MOQ/lead_time/expiration.
