# Structured waste reason categories (2026-08-31)

Branch: `cursor/mise-waste-reason-categories`
Base: `origin/main` @ `20b28e5`

## Closed

Waste ledger transport already accepted optional `reason_code` /
`p_reason_code`, but operators only entered free-text notes and Waste analysis
ignored the field. This slice wires a bounded allowlist end to end without a
migration.

- Domain allowlist: `spoilage`, `prep_trim`, `overproduction`, `dropped_broken`,
  `expired`, `other` in `services/domain/wasteReasonCodes.ts`
- Validation: waste ops accept only allowlisted codes (or omit); non-waste ops
  keep free-form optional `reasonCode`
- Analysis: `topReasons` breakdown, recent-event `reasonCode`,
  `dominant_spoilage` attention when spoilage/expired ≥ 50% of a window
  (≥ 2 events), and `review_spoilage` recommended action
- Inventory detail: waste reason pill picker required before save; passes
  `reasonCode` into `queueInventoryOperation`
- Waste hub + Daily Report copy for the new action; EN/ES/zh-Hans catalog keys

## Verification

- `npm run typecheck`
- Focused: wasteReasonCodes, wasteAnalysis, inventoryOperationValidation,
  dailyOpsReport, dailyPhaseBrief
- `npm test` — 636 pass / 0 fail / 7 cancelled
- `npm run security:static`

## Contested merge note

Touches `app/inventory/[id].tsx` and `app/more/waste.tsx` additively (same
files as open #214/#262). Rebase after those land; picker should carry into
staff-only waste UI and waste deeplink flows.

## Not in this slice

- Inventing MOQ / lead time / expiration fields
- Purchase-unit correction or ingredient_substitutions CRUD (Codex-gated)
- Hosted pgTAP / live POS / founder legal URLs
