# MISE-005YB: Home ApprovalsSection recommendedAction ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-home-approvals-recommended-action-ascii-c`  
Base: `origin/main` @ `78da7376`

## Problem

Home ApprovalsSection always passed raw `card.recommendedAction` into the
cardBody Text. Empty / Unicode-only-space recommended actions rendered
blank-looking action copy on Needs-your-approval cards. Unicode `.trim()` on
padded recommended actions would invent a clean action label.

## Changes

- Add `services/domain/presentationHomeApprovalsRecommendedActionIdentity.ts`
  (multiline operator_note-style ASCII C prep; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route ApprovalsSection cardBody through
  `normalizeHomeApprovalsRecommendedAction` so unsafe actions fall through to
  localized `home.approvals.recommendedAction.none` (EN / ES / zh-Hans)
- Leave ApprovalsSection `card.title` (#1049), `whyItMatters`, Home StatusNotice
  approval titles (#1011), Home greeting restaurant.name (#1044), and finding /
  Daily Brief recommended-action domain tips alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the cardBody Text
  with no localized none fallback
- `"\u2003Order 12 lb from Fresh Produce Co.\u2003".trim() === "Order 12 lb from Fresh Produce Co."`
  inventing equality
- ASCII C soft-null restores `home.approvals.recommendedAction.none`

## Alone-OK

No migration. Alone-OK on main beside #1049 / #1100–#1133; ordinary UI conflicts
possible with Home inventing stacks. Distinct from card.title (#1049) and from
finding / Daily Brief recommended-action domain tips (#832 / #884).

## Verification

- Focused `tests/homeApprovalsRecommendedActionAsciiC.test.ts` (5/5)
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled — inherited recalculationCycles timer flake)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
