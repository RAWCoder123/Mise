# Activity actionId ASCII C (MISE-005AAN)

Date: 2026-11-09
Branch: `cursor/mise-activity-action-id-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Activity expanded action detail selected its id with:

```ts
{event.actionId ? (
  <Text>…{event.actionId}</Text>
) : null}
```

Unicode-only-space / empty-looking ids are truthy, so the detail line
rendered blank-looking action identity (`"Action:  "`). Unicode `.trim()`
on em-space-padded ids would invent a clean action identity if used as a
prep gate before interpolation.

Open #761 / #772 pin Mise-actions domain `actionId` surfaces only. They do
not pin Activity presentation of `event.actionId`. Open #1198 / #1197 pin
Activity `relatedEntityId` / `triggerReference` presentation only.

## Changes

- Add `services/domain/presentationActivityActionIdIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Activity action detail through
  `normalizeActivityActionId(event.actionId)` with soft-null → omit action
  detail line (prior falsy omit-action fallback)
- Leave relatedEntityId display (#1198 / MISE-005AAM), triggerReference
  display (#1197 / MISE-005AAL), event.category, triggerType,
  Mise-actions actionId tips (#761 / #772), Activity title/summary i18n
  (#271), and Activity hub label i18n (#239) alone

## Inventing / bypass proof

- `"\u2003act_8e2b4f71\u2003".trim() === "act_8e2b4f71"` inventing equality
  for a clean action id
- `"\u2003"` is truthy and previously forced a blank-looking action detail
  line
- ASCII C soft-null restores the omit-action fallthrough

Distinct from Mise-actions orderId/actionId tips (#761 / #772) and from
Activity relatedEntityId / triggerReference display (#1198 / #1197).

## Alone-OK

No migration. Alone-OK on main beside #1198 / #1197 / #761 / #772 / #271 /
#239 / #1196 / #1195; ordinary conflicts possible only if another tip
rewrites the same Activity actionId interpolation or the shared
`app/more/activity.tsx` import block. Does not share identity modules with
those tips.

## Verification

- Focused `tests/activityActionIdAsciiC.test.ts`: 5/5 (54 assertion call sites from source)
- `npm run typecheck`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited withTimeout cancelledByParent; fixed in #1183, not landed)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
