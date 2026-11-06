# MISE-005YD: pin Home StatusNotice whyItMatters to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-home-status-why-it-matters-ascii-c`  
Base: `origin/main` @ `78da7376`

## Closed

Home restaurant-status `StatusNotice` previously selected its message with:

```ts
primaryApproval?.whyItMatters ?? brief.restaurantStatus.summary
```

Nullish coalescing left empty-string and Unicode-only-space why copy non-nullish, so blank-looking StatusNotice body text rendered and blocked the restaurant-status summary fallback. Unicode `.trim()` on em-space-padded why copy would invent a clean display reason.

This tip soft-nulls empty / Unicode-padded / unsafe multiline why copy through `normalizeHomeStatusWhyItMatters` so the live `|| brief.restaurantStatus.summary` branch owns the intentional fallback.

## Inventing / bypass proof

- `"" ?? "SUMMARY" === ""` — empty string bypasses summary fallback
- `"\u2003" ?? "SUMMARY" === "\u2003"` and `Boolean("\u2003") === true` — Unicode-only space still rendered
- `"\u2003Lunch usage was 24% above forecast.\u2003".trim() === "Lunch usage was 24% above forecast."` — inventing equality
- ASCII C soft-null restores `brief.restaurantStatus.summary`

## Left alone

- StatusNotice approval titles (#1011 / MISE-005VC)
- ApprovalsSection `card.whyItMatters` (#1135 / MISE-005YC)
- ApprovalsSection `card.title` (#1049 / MISE-005WO)
- ApprovalsSection `recommendedAction` (#1134 / MISE-005YB)
- Home greeting `restaurant.name` (#1044 / MISE-005WJ)
- Finding / Daily Brief recommended-action domain tips (#832 / #884)

## Alone-OK

No migration. Alone-OK on main beside #1011 / #1135 / #1049 / #1134 / #1100–#1133. Ordinary UI conflicts possible with other Home inventing stacks. Distinct from ApprovalsSection whyItMatters (#1135) and StatusNotice titles (#1011).

## Verification

- Focused `tests/homeStatusWhyItMattersAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
