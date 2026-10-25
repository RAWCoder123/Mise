# MISE-005QE: pin operating-plan why / completion-result text to ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-operating-plan-why-ascii-c`

## Inventing proof

`whyForTask` and `completionResultForTask` Unicode-trimmed
`recommendation.reason`, `task.detail`, matched activity `summary`, and matched
activity `title`, then stored the trimmed result on Daily Operating Plan items.
Em-space / NBSP padding invented clean why / completion prose:

```text
'\u2003Need reorder before lunch\u2003'.trim() === 'Need reorder before lunch'
```

Soft-empty Unicode-only padding collapsed into the intentional empty fallthrough.

Open #684 owns prep-window tokens only. Open #736 owns restaurant workspace
identity. Neither owns these why / completion-result free-text selection paths.

## Change

- `services/domain/operatingPlanWhyIdentity.ts` — NBSP fold + C-end trim only;
  preserve internal LF/TAB/CR; soft empty / unsafe control → `null`
- Wire `whyForTask` and `completionResultForTask` through
  `normalizeOperatingPlanWhyText`
- Leave `restaurantId.trim()` and `evidenceFromPrepWindows` on their existing
  Unicode contracts for sibling tips

## Alone-OK merge notes

Alone-OK with #684 / #736. Keep `operatingPlanWhyIdentity.ts` separate. When
landing with #684, keep the assertion that prep-window tokens still use
`raw.trim().toLocaleLowerCase("en-US")` until that tip lands. When landing with
#736, keep the assertion that `input.restaurantId.trim()` remains until that tip
lands.

## Verification

- focused `tests/operatingPlanWhyAsciiC.test.ts` (4/4)
- `npm run typecheck` — passed
- `npm run security:static` / `npm run security:backend` — passed
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing)
- Docker pgTAP unavailable in this environment
