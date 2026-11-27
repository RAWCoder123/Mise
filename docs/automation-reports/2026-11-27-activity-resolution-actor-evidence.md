# Activity resolution actor INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-activity-resolution-actor-evidence-main`

## Gap

`activity_events.resolved_by` is nullable so account-deletion anonymization can
clear only the deleted operator's auth identity (`ON DELETE SET NULL` + the
append-only UPDATE escape). The existing resolution CHECK intentionally allows
`resolved_at` without `resolved_by` after that anonymization escape.

Hosted `private.append_activity_event` never writes resolution fields. Direct
INSERTs could still mint `resolved_at` with `resolved_by = null`, leaving an
unattributable resolution.

## Change

- Domain: `validateActivityResolutionActorEvidence` → `missing_resolved_by`
  when `resolved_at` is present and the resolver is absent.
- Additive BEFORE INSERT tip only (no NOT NULL / tighter CHECK).
- Unresolved inserts remain allowed without `resolved_by`.
- Does not rewrite `append_activity_event`.
- pgTAP plan = 11 (derived from assertion call sites).

## Alone-OK

Orthogonal to activity locale / ASCII-C pins, #1299 restaurant-memory decision
actor, #1298 mise-actions decision actor, #1297 supplier-delivery verified_by,
and inventory / purchase-line actor tips.

## Verification

- `npm run typecheck` — passed
- focused activity resolution-actor suite — 4/4
- `npm test` — 680 passed / 0 fail / 7 cancelled (known `withTimeout` flaky suite; open #1183)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — Docker unavailable in this environment
