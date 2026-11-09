# Activity relatedEntityId ASCII C (MISE-005AAM)

Date: 2026-11-09
Branch: `cursor/mise-activity-related-entity-id-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Activity expanded related-entity detail selected its id suffix with:

```ts
{event.relatedEntityId ? ` · ${event.relatedEntityId}` : ""}
```

Unicode-only-space / empty-looking ids are truthy, so the detail line
rendered blank-looking related-entity identity
(`"Related: inventory_item ·  "`). Unicode `.trim()` on em-space-padded
ids would invent a clean related-entity identity if used as a prep gate
before interpolation.

Open #573 pins `activity_events.related_entity_id` with a COLLATE C cntrl
CHECK only. It does not pin Activity presentation of the field. Open
#1197 pins Activity `triggerReference` presentation only.

## Changes

- Add `services/domain/presentationActivityRelatedEntityIdIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Activity related-entity detail through
  `normalizeActivityRelatedEntityId(event.relatedEntityId)` with soft-null →
  omit id suffix (prior falsy related-entity-type-only fallback)
- Leave triggerReference display (#1197 / MISE-005AAL), event.category,
  Activity title/summary i18n (#271), Activity hub label i18n (#239), and
  #573 cntrl CHECK alone

## Inventing / bypass proof

- `"\u2003inv_9c4e1a02\u2003".trim() === "inv_9c4e1a02"` inventing equality
  for a clean related-entity id
- `"\u2003"` is truthy and previously forced a blank-looking related-entity
  detail suffix
- ASCII C soft-null restores the omit-id related-entity-type-only
  fallthrough

Distinct from activity_events.related_entity_id cntrl CHECK (#573 /
MISE-005FI) and from Activity triggerReference display (#1197 /
MISE-005AAL).

## Alone-OK

No migration. Alone-OK on main beside #573 / #572 / #571 / #1197 / #271 /
#239 / #1196 / #1195; ordinary conflicts possible only if another tip
rewrites the same Activity relatedEntityId interpolation or the shared
`app/more/activity.tsx` import block. Does not share identity modules with
those tips.

## Verification

- Focused `tests/activityRelatedEntityIdAsciiC.test.ts`
- `npm run typecheck`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
