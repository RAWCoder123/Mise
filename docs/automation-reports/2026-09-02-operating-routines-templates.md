# Operating routines templates — main rebase (2026-11-05)

Tip: `cursor/mise-operating-routines-templates-main-rebase` — MERGEABLE onto `origin/main`.
Supersedes stale #343 (`cursor/mise-operating-routines-templates`), which was behind main (`20b28e50` base; main advanced through MISE-004C / MISE-005A).

## Gap
Shared restaurant tasks supported one-off create, but managers had no day-scoped opening, closing, or food-safety routine packs. That left the operating-routines product requirement without an operator path.

## Slice
- Domain templates in `services/domain/operatingRoutines.ts` with deterministic `clientTaskId` / `sourceReference` keys `routine:{id}:{step}:{YYYY-MM-DD}`.
- Application `materializeOperatingRoutine` lists existing shared tasks, creates only missing drafts via the existing `create_restaurant_task` path, and fails closed without manager authority.
- More → Operating routines screen; EN/ES/zh-Hans catalog keys; route smoke registration.
- No migration; session-only product tip.

## Non-goals
No new recurrence tables, photo capture, or invented MOQ/lead_time/expiration fields. Staff still complete tasks; managers add the day’s pack. Out of scope: ASCII-C inventing on step titles / restaurant name interpolations (separate tip only with inventing/bypass proof).

## Land notes
Do not merge stale #343. Prefer this tip. Cherry-pick of `a96c9697` onto `78da7376` auto-merged `services/miseService.ts` with current purchase-line ledger exports.

## Verification
- `npm run typecheck`
- focused operatingRoutines tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`

## Follow-ons
- Next alone-OK no-migration product tip still missing main: #334 supplier catalog read
- Prefer landing MERGEABLE stacks #1100→#1102, #1103, #1099–#1088 before migration tips #291/#358/#381
