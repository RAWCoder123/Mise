# Operating routines templates (2026-09-02)

## Gap
Shared restaurant tasks supported one-off create, but managers had no day-scoped opening, closing, or food-safety routine packs. That left the operating-routines product requirement without an operator path.

## Slice
- Domain templates in `services/domain/operatingRoutines.ts` with deterministic `clientTaskId` / `sourceReference` keys `routine:{id}:{step}:{YYYY-MM-DD}`.
- Application `materializeOperatingRoutine` lists existing shared tasks, creates only missing drafts via the existing `create_restaurant_task` RPC path, and fails closed without manager authority.
- More → Operating routines screen; EN/ES/zh-Hans catalog keys; route smoke registration.

## Non-goals
No new recurrence tables, photo capture, or invented MOQ/lead_time/expiration fields. Staff still complete tasks; managers add the day’s pack.

## Verification
- `npm run typecheck`
- `npm test` (domain + UI static)
- `npm run security:static`
