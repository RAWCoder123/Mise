# Home StatusNotice topRisk ASCII C (MISE-005YF)

Date: 2026-11-06
Branch: `cursor/mise-home-status-top-risk-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Home restaurant-status `StatusNotice` selected its message with:

```ts
const topRisk = brief.restaurantStatus.topRisk?.trim();
message={topRisk ? t(statusKey) : primaryApproval?.whyItMatters ?? brief.restaurantStatus.summary}
```

Unicode `.trim()` on em-space-padded topRisk copy invents clean gate presence and forces the localized status-sentence branch. Soft empty / Unicode-only-space topRisk must fall through to why-it-matters / summary without inventing.

## Changes

- Add `services/domain/homeStatusTopRiskIdentity.ts` (multiline operator_note-style ASCII C prep; soft-null on empty / Unicode-padded / unsafe controls)
- Route StatusNotice topRisk gate through `normalizeHomeStatusTopRisk` so unsafe topRisk copy falls through to `primaryApproval?.whyItMatters ?? brief.restaurantStatus.summary`
- Leave StatusNotice summary (#1137), StatusNotice whyItMatters (#1136), ApprovalsSection whyItMatters (#1135), recommendedAction (#1134), card.title (#1049), StatusNotice approval titles (#1011), and Home greeting restaurant.name (#1044) alone

## Inventing / bypass proof

- `"\u2003Chicken breast is projected to stock out before dinner.\u2003".trim() === "Chicken breast is projected to stock out before dinner."` inventing equality for the message gate
- `Boolean("\u2003") === true` would force `t(statusKey)` under raw truthiness without soft-null
- ASCII C soft-null restores the why-it-matters / summary fallthrough

Distinct from #1137: that tip soft-nulls summary into the localized status sentence; this tip soft-nulls the topRisk gate so unsafe padding cannot invent status-sentence selection.

## Alone-OK

No migration. Alone-OK on main beside #1137 / #1136 / #1135 / #1134 / #1049 / #1011 / #1044 / #1100–#1133; ordinary UI conflicts possible with Home inventing stacks.

## Verification

- Focused `tests/homeStatusTopRiskAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
