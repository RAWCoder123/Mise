# Ask Mise briefing miseStatus localization (2026-08-29)

## Problem

Ask Mise briefing interpolated raw English `summary.miseStatus` into
`ask.answer.briefing.lead`, so Spanish and Simplified Chinese briefings still
quoted `Ready` / `Watch` / `Attention` / the monitoring sentence in English.
Daily Report closeout badges had the same raw badge copy.

## Fix

- Added `presentMiseStatusLabel` for the exact known status strings emitted by
  Today summary / Daily Report (Ready, Watch, Attention, monitoring sentence).
- Unknown status text is shown as-is; blank falls back to an em dash — no
  invented operational facts.
- Wired Ask Mise briefing and the Daily Report badge through the presenter.
- Catalog keys: `dailyReport.miseStatus.*` in EN, ES, and zh-Hans.

## Tests

- `tests/miseStatusLabel.test.ts`
- `tests/askMise.test.ts` briefing localization + unknown-status preserve

## Out of scope

Create Task role/status detail labels (open #256). Invite-gated Auth signup
(founder Auth policy). Soft-cap pickers and other open stacks.
