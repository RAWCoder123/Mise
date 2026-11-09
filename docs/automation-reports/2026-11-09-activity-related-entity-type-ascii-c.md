# Activity relatedEntityType ASCII C (MISE-005AAO)

Date: 2026-11-09
Branch: `cursor/mise-activity-related-entity-type-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Activity expanded related detail selected its type with:

```ts
{event.relatedEntityType ? (
  <Text>…{event.relatedEntityType.replace(/_/g, " ")}</Text>
) : null}
```

Unicode-only-space / empty-looking types are truthy, so the detail line
rendered blank-looking related identity (`"Related:  "`). Unicode `.trim()`
on em-space-padded types would invent a clean related-entity type if used as a
prep gate before interpolation (and before underscore→space humanize).

Open #572 pins the `activity_events.related_entity_type` cntrl CHECK only. It
does not pin Activity presentation of `event.relatedEntityType`. Open #1199 /
#1198 / #1197 pin Activity `actionId` / `relatedEntityId` / `triggerReference`
presentation only.

## Changes

- Add `services/domain/presentationActivityRelatedEntityTypeIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Activity related detail through
  `normalizeActivityRelatedEntityType(event.relatedEntityType)` with soft-null
  → omit related detail line (prior falsy omit-related fallback)
- Keep underscore→space humanize as a post-normalize step on the safe token
- Leave relatedEntityId display (#1198 / MISE-005AAM), actionId display
  (#1199 / MISE-005AAN), triggerReference display (#1197 / MISE-005AAL),
  event.category, triggerType, related_entity_type cntrl CHECK (#572 /
  MISE-005FH), Activity title/summary i18n (#271), and Activity hub label
  i18n (#239) alone

## Inventing / bypass proof

- `"\u2003purchase_order\u2003".trim() === "purchase_order"` inventing equality
  for a clean related-entity type
- `"\u2003"` is truthy and previously forced a blank-looking related detail
  line
- ASCII C soft-null restores the omit-related fallthrough

Distinct from relatedEntityId / actionId / triggerReference display
(#1198 / #1199 / #1197) and from related_entity_type cntrl CHECK (#572).

## Alone-OK

No migration. Alone-OK on main beside #1199 / #1198 / #1197 / #572 / #271 /
#239; ordinary conflicts possible only if another tip rewrites the same
Activity relatedEntityType interpolation or the shared
`app/more/activity.tsx` import block. Does not share identity modules with
those tips.

## Verification

- Focused `tests/activityRelatedEntityTypeAsciiC.test.ts`: 5/5 (56 assertion call sites from source)
- `npm run typecheck`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited withTimeout cancelledByParent; fixed in #1183, not landed)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
