# MISE-005YE: pin Home StatusNotice restaurantStatus.summary to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-home-status-summary-ascii-c`  
Base: `origin/main` @ `78da7376`

## Problem

Home restaurant-status `StatusNotice` selected its message with
`primaryApproval?.whyItMatters ?? brief.restaurantStatus.summary`. When the
why-it-matters operand was nullish, empty-string and Unicode-only-space summary
copy are non-nullish, so blank-looking StatusNotice body text rendered with no
intentional localized status-sentence fallback. Unicode `.trim()` on
em-space-padded summary copy would invent a clean display summary.

## Changes

- Add `services/domain/homeStatusRestaurantSummaryIdentity.ts` (multiline
  operator_note-style ASCII C prep; soft-null on empty / Unicode-padded /
  unsafe controls)
- Route StatusNotice summary through `normalizeHomeStatusRestaurantSummary` so
  unsafe summary copy falls through to `t(statusKey)`
  (`home.status.attention_needed` / `home.status.at_risk`)
- Leave StatusNotice whyItMatters (#1136), ApprovalsSection whyItMatters
  (#1135), recommendedAction (#1134), card.title (#1049), StatusNotice
  approval titles (#1011), Home greeting restaurant.name (#1044), and the
  `topRisk?.trim()` message gate alone

## Inventing / bypass proof

- `"" ?? "STATUS_KEY" === ""` previously still rendered a blank StatusNotice
  message when the message chain ended at summary
- `Boolean("\u2003") === true` previously still rendered after skipping the
  localized status-sentence fallback
- `"\u2003Attention needed: 1 approval and 2 inventory watch items are open.\u2003".trim() ===
  "Attention needed: 1 approval and 2 inventory watch items are open."`
  inventing equality
- ASCII C soft-null restores `t(statusKey)`

Distinct from #1136: that tip soft-nulls `primaryApproval?.whyItMatters` into
summary; this tip soft-nulls summary into the localized status sentence.

## Alone-OK

No migration. Alone-OK on main beside #1136 / #1135 / #1134 / #1049 / #1011 /
#1044 / #1100–#1133; ordinary UI conflicts possible with Home inventing stacks.

## Verification

- Focused `tests/homeStatusRestaurantSummaryAsciiC.test.ts` (5/5)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled — inherited recalculationCycles timer flake)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
