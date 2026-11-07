# MISE-005YQ: Home ActivityRow event.title ASCII C

Date: 2026-11-07  
Branch: `cursor/mise-home-activity-row-title-ascii-c`  
Base: `origin/main` @ `78da7376`

## Problem

Home live-activity rows always passed raw `event.title` into the title Text.
Empty / Unicode-only-space titles are non-nullish (and Unicode-only-space is
truthy), so blank-looking activity identity rendered with no intentional
localized none marker. Unicode `.trim()` on padded titles would invent a clean
activity label.

## Changes

- Add `normalizeHomeActivityRowTitle` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold)
- Route Home ActivityRow title Text `event.title` through soft-null before
  `|| t("home.activity.row.title.none")`
- Add EN / ES / zh-Hans `home.activity.row.title.none`
- Focused inventing / bypass proofs in `tests/homeActivityRowTitleAsciiC.test.ts`

## Ownership

Owns only Home ActivityRow display **title → home.activity.row.title.none**.
Leaves Activity hub row title (#1148), Activity expand a11y title (#1071),
Home ActivityRow `event.summary`, Activity `event.summary`, Create Task
list-row a11y (#1072), and Home ApprovalsSection card.title (#1049) alone.
Explicitly left alone by #1148 ownership (“Home ActivityRow event.title
display”).

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered blank-looking title Text
- `"\u2003Order approved\u2003".trim() === "Order approved"` inventing equality
- ASCII C soft-null restores `home.activity.row.title.none`

## Alone-OK

No migration. Beside #1148 / #1071 / #1049 / #1072 (no shared modules). Distinct
from Activity hub row title tip (#1148 / MISE-005YP).

## Verification

- focused `tests/homeActivityRowTitleAsciiC.test.ts` 5/5 (51 assertion call
  sites; plan from source)
- `npm run typecheck` passed
- `npm run security:static` + `security:backend` passed
- `npm run design:static` passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
