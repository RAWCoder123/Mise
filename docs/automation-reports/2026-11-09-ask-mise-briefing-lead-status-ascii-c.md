# MISE-005ABC: pin Ask Mise briefing.lead status to ASCII C

Date: 2026-11-09  
Branch: `cursor/mise-ask-mise-briefing-lead-status-ascii-c`  
Base: `origin/main` @ `78da7376`

## Summary

Soft-null empty / Unicode-padded / control-bearing `summary.miseStatus` before
interpolating into `ask.answer.briefing.lead` `{status}`, so Ask Mise briefing
answers fall through to localized `ask.answer.briefing.status.none` instead of
inventing a clean status identity or rendering blank-looking lead copy.

## Changes

- `services/domain/presentationAskMiseBriefingLeadStatusIdentity.ts` — ASCII C
  single-line normalize (end trim only; preserve NBSP; full C0/DEL reject)
- `services/ai/askMise.ts` — soft-null before briefing.lead `{status}`
- `i18n/catalog.ts` — EN/ES/zh-Hans `ask.answer.briefing.status.none`
- Focused inventing/bypass tests + this automation report

## Ownership

Owns only Ask Mise `ask.answer.briefing.lead` `{status}` →
`ask.answer.briefing.status.none`. Leaves Ask Mise briefing.lead restaurant.name
(#1211), thinkingSteps restaurant.name (#1210), greeting.body restaurant.name
(#1045), greeting firstName (#961), Daily Report Badge `day.miseStatus`,
attentionTitles (#1209), topTaskTitles (#1164), and presentedInsight.title
(#1213) alone.

## Inventing proof

- Prior always-pass `summary.miseStatus` into `ask.answer.briefing.lead`
- Unicode-only-space blank-looking interpolate (`Boolean("\u2003") === true`)
- Unicode trim invents clean status (`"\u2003Ready\u2003".trim() === "Ready"`)
- Soft-null restores localized `ask.answer.briefing.status.none` while sibling
  restaurant.name still receives the raw name on this tip
- Daily Report Badge `day.miseStatus` left raw (distinct surface)

## Verification

- Focused `tests/askMiseBriefingLeadStatusAsciiC.test.ts` 1/1 (73 assertion
  call sites counted from source)
- `npm run typecheck`
- `npm test`
- No migration
