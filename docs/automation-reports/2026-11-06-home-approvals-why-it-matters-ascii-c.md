# MISE-005YC: pin Home ApprovalsSection whyItMatters to ASCII C

Date: 2026-11-06  
Branch: `cursor/mise-home-approvals-why-it-matters-ascii-c`  
Base: `origin/main` @ `78da7376`

## Problem

Home ApprovalsSection always passed raw `card.whyItMatters` into the metaLine
Text after the localized "Why it matters" label. Empty / Unicode-only-space why
copy rendered blank-looking reason text on Needs-your-approval cards; Unicode
`.trim()` on padded why copy would invent a clean reason.

## Changes

- Add `services/domain/presentationHomeApprovalsWhyItMattersIdentity.ts`
  (multiline operator_note-style ASCII C prep; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route ApprovalsSection metaLine through `normalizeHomeApprovalsWhyItMatters`
  so unsafe why copy falls through to localized
  `home.approvals.whyItMatters.none` (EN / ES / zh-Hans)
- Leave ApprovalsSection `card.title` (#1049), `recommendedAction` (#1134),
  Home StatusNotice approval titles (#1011), StatusNotice
  `primaryApproval?.whyItMatters` message pass-through, and Home greeting
  restaurant.name (#1044) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered after the why label
  with no localized none fallback
- `"\u2003Lunch usage was 24% above forecast.\u2003".trim() === "Lunch usage was 24% above forecast."`
  inventing equality
- ASCII C soft-null restores `home.approvals.whyItMatters.none`

## Alone-OK

No migration. Alone-OK on main beside #1049 / #1134 / #1100–#1133; ordinary UI
conflicts possible with Home inventing stacks. Distinct from card.title (#1049)
and recommendedAction (#1134).

## Verification

- Focused `tests/homeApprovalsWhyItMattersAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
