# Cursor Handoff

Updated: 2026-07-28

Status: ready when the Cursor desktop session is unlocked.

## Base checkpoint

- Use repository state at or after `13bbeb1`.
- The last Cursor-authored checkpoint observed by Codex was `debf9f1`.
- Codex has since completed hosted account deletion, restaurant export,
  deterministic daily findings, append-only manager feedback, exact feedback
  application to later briefs, restart-safe feedback delivery, and bounded
  hosted race verification.
- Do not rewrite or revert those backend checkpoints.

## Cursor-owned slice A — Daily brief presentation

Allowed paths:

- `app/(tabs)/today.tsx`
- `app/(tabs)/insights.tsx`
- `i18n/catalog.ts`
- focused UI tests

Use only `fetchDailyOperationalBrief(restaurantId)` from
`services/miseService.ts`. Do not call repositories, Supabase, or AI providers
from a screen.

Requirements:

- Render compact `Now`, `Up next`, and `Later` sections using
  `brief.priorities` and the stable finding IDs.
- Show severity, confidence, freshness, missing-data warnings, evidence count,
  affected workflow, and recommended action without inventing evidence.
- Use tomato red only for urgent/primary state, green for fresh/healthy state,
  and warm neutral surfaces for supporting content.
- Add loading, empty, stale, incomplete, error, and permission-safe states.
- Keep 44px controls, screen-reader labels, Dynamic Type resilience, and no
  horizontal overflow at supported phone widths.
- Translate fixed UI labels in English, Spanish, and Simplified Chinese.
  Restaurant-entered or deterministic evidence copy may remain opaque source
  evidence, consistent with the existing Insight presentation policy.

## Cursor-owned slice B — Restaurant export interaction

Allowed paths:

- `app/(tabs)/settings.tsx`
- a new route under `app/settings/`
- `i18n/catalog.ts`
- focused UI tests

Use only `exportRestaurantData(restaurantId)` from `services/miseService.ts`.
The service already validates schema, byte size, counts, tenant identity,
  protected keys, and all 25 datasets. Never log the payload.

Requirements:

- Show the export control only to owners and admins.
- Serialize the returned object as a JSON file. On iOS, use the installed
  `expo-file-system` and `expo-sharing` SDK modules; on web, use a bounded Blob
  download.
- Use a safe filename such as `mise-restaurant-export-YYYY-MM-DD.json`.
- Show progress, cancellation-safe navigation, success, unavailable-sharing,
  oversized/support, and generic failure states.
- Explain that provider credentials and private security logs are excluded.
- Do not add a public pricing, purchase, Gmail-send, or autonomous-order action.

## Cursor-owned slice C — Finding feedback interaction

Allowed paths:

- `app/(tabs)/today.tsx`
- `app/(tabs)/insights.tsx`
- `i18n/catalog.ts`
- focused UI tests

Use only `queueOperationalFindingDecision(input)`,
`fetchQueuedOperationalFindingDecisions(restaurantId)`, and
`flushQueuedOperationalFindingDecisions(restaurantId)` from
`services/miseService.ts`. Do not call the direct record method from a screen.
The exact `OperationalFinding` returned by `fetchDailyOperationalBrief` must be
passed back unchanged.

Requirements:

- Owners, admins, and managers may approve, edit, or dismiss a finding; staff
  remain read-only.
- The queue generates and persists one stable `clientEventId` and
  `idempotencyKey`; never reconstruct or replace the queued payload after an
  ambiguous transport result.
- An edit requires a distinct, non-empty action capped by the service contract.
- Disable duplicate taps while the request is pending and show applied,
  retryable failure, permission, and conflict states.
- Flush after queueing and when connectivity returns. Pending or interrupted
  entries remain durable across app restart.
- Do not imply that feedback changed inventory, sent an order, or rewrote the
  original evidence.
- Keep the original evidence and recommended action visible after feedback.
- Render `finding.managerFeedback` from every refreshed brief. Its
  `effectiveRecommendedAction` is a manager annotation, not rewritten
  operational evidence.
- Use compact tomato-red primary actions, warm neutral secondary controls,
  44px targets, accessible labels, and localized fixed copy.

## Locked shared paths

Until Codex records an explicit handoff, Cursor must not edit:

- `services/**`
- `supabase/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `app.json`
- `docs/launch/**` other than appending a completed Cursor checkpoint to this
  handoff file

Run:

- `npm run typecheck`
- `npm test`
- `npm run design:static`
- mobile interaction verification for `/today`, `/insights`, and `/settings` in
  all three supported locales
