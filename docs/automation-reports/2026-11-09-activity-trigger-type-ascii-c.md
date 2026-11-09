# Activity triggerType ASCII C (MISE-005AAP)

Date: 2026-11-09
Branch: `cursor/mise-activity-trigger-type-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Activity expanded trigger detail always passed free-form `event.triggerType`
with no prep gate:

```ts
{t("activity.detail.trigger")}: {event.triggerType}
```

Unicode-only-space types rendered blank-looking trigger identity
(`"Trigger:  "`). Unicode `.trim()` on em-space-padded types would invent a
clean trigger identity if used as a prep gate before interpolation —
including through open Activity hub label i18n (#239)
`humanizeActivityToken`, which Unicode-trims unknown free-form triggers.

Open #568 pins `activity_events.trigger_type` with a COLLATE C cntrl CHECK
only. It does not pin Activity presentation of the field. Open #239
localizes known triggers but does not close ASCII-C inventing for free-form
or padded tokens.

## Changes

- Add `services/domain/presentationActivityTriggerTypeIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Activity trigger detail through
  `normalizeActivityTriggerType(event.triggerType) ?? ""` with soft-null →
  empty-type display (prior empty-string fallthrough)
- Leave triggerReference (#1197), relatedEntityType (#1200), relatedEntityId
  (#1198), actionId (#1199), event.category / event.status, Activity
  title/summary i18n (#271), Activity hub label i18n (#239), and #568 cntrl
  CHECK alone

## Inventing / bypass proof

- `"\u2003pos_sync\u2003".trim() === "pos_sync"` inventing equality for a
  clean trigger type
- `"\u2003"` previously forced blank-looking trigger-detail identity
- ASCII C soft-null restores the empty-type fallthrough

Distinct from activity_events.trigger_type cntrl CHECK (#568 / MISE-005FD)
and from Activity hub trigger label i18n (#239).

## Alone-OK

No migration. Alone-OK on main beside #1197 / #1200 / #1198 / #1199 / #568 /
#577 / #271 / #239; ordinary conflicts possible only if another tip rewrites
the same Activity triggerType interpolation. Does not share identity modules
with those tips.

## Verification

- Focused `tests/activityTriggerTypeAsciiC.test.ts`
- `npm run typecheck`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
