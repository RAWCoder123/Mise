# Activity triggerReference ASCII C (MISE-005AAL)

Date: 2026-11-09
Branch: `cursor/mise-activity-trigger-reference-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Activity expanded trigger detail selected its correlation-ref suffix with:

```ts
{event.triggerReference ? ` · ${event.triggerReference}` : ""}
```

Unicode-only-space / empty-looking references are truthy, so the detail line
rendered blank-looking correlation identity (`"Trigger: schedule ·  "`).
Unicode `.trim()` on em-space-padded references would invent a clean
correlation identity if used as a prep gate before interpolation.

Open #571 pins `activity_events.trigger_reference` with a COLLATE C cntrl
CHECK only. It does not pin Activity presentation of the field.

## Changes

- Add `services/domain/presentationActivityTriggerReferenceIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Activity trigger detail through
  `normalizeActivityTriggerReference(event.triggerReference)` with soft-null →
  omit reference suffix (prior falsy trigger-type-only fallback)
- Leave relatedEntityId display, event.category, Activity title/summary i18n
  (#271), Activity hub label i18n (#239), and #571 cntrl CHECK alone

## Inventing / bypass proof

- `"\u2003rec_7f3a2b1c\u2003".trim() === "rec_7f3a2b1c"` inventing equality for
  a clean correlation ref
- `"\u2003"` is truthy and previously forced a blank-looking trigger-detail
  suffix
- ASCII C soft-null restores the omit-reference trigger-type-only fallthrough

Distinct from activity_events.trigger_reference cntrl CHECK (#571 /
MISE-005FG) and from Activity relatedEntityId display (still open).

## Alone-OK

No migration. Alone-OK on main beside #571 / #573 / #568 / #576 / #271 / #239 /
#1196 / #1195; ordinary conflicts possible only if another tip rewrites the
same Activity triggerReference interpolation. Does not share identity modules
with those tips.

## Verification

- Focused `tests/activityTriggerReferenceAsciiC.test.ts`
- `npm run typecheck`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
