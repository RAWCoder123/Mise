# Activity user actor INSERT evidence (2026-11-27)

## Gap

`activity_events.actor_user_id` is nullable so mise / system / integration
actors can leave it null, and so account-deletion anonymization can clear only
the deleted operator's auth identity (`ON DELETE SET NULL` + the append-only
UPDATE escape). Hosted `private.append_activity_event` forwards actor fields
without requiring `actor_type = 'user'` to carry a non-null `actor_user_id`.
Direct inserts can therefore mint unattributable human activity.

## Change

- Domain: `validateActivityUserActorEvidence` → `missing_actor_user_id`
- Additive BEFORE INSERT tip only on `public.activity_events`
- No NOT NULL / tighter CHECK (preserves anonymization)
- Does not rewrite `append_activity_event`
- mise / system / integration inserts remain allowed without `actor_user_id`
- pgTAP plan = 11 (derived from assertion call sites)

## Alone-OK

Orthogonal to activity resolution-actor tip (#1300), activity locale / ASCII-C
pins, and inventory / purchase-line / mise-action / count-session actor tips.
Does not conflict with unconditional `actor_user_id` NOT NULL (left alone
because non-user actors legitimately null).

## Verification

- `npm run typecheck`
- focused `activityUserActorEvidence` suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
