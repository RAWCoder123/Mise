# Count material variance notes (2026-08-31)

## Summary

Material inventory-count variances now require a trimmed variance note (≤240 chars) before submit or approve. Gates run in domain, application, demo repository, and the operational-workflows Edge path (service-role RPCs remain the SQL boundary).

## Thresholds

Purchase-unit defaults (AND):

- absolute quantity ≥ 1
- percentage ≥ 10% (floor denominator 1)

Aligned / sub-threshold variances do not require notes.

## Changed paths

- `services/domain/inventoryCountSessions.ts`
- `services/application/inventory.ts`
- `services/repositories/demoRepository.ts`
- `supabase/functions/operational-workflows/index.ts`
- `app/inventory/count.tsx`
- `i18n/catalog.ts` (EN/ES/zh-Hans)
- `tests/inventoryCountSessions.test.ts`
- `tests/security.test.ts`

## Verification

- `npm run typecheck` pass
- `npm test` 633 pass / 0 fail / 7 cancelled
- `npm run security:static` pass
- No migration (Edge + application fail-closed; SQL RPCs remain service_role-only)

## Residual

- Optional Codex SQL pin inside `service_submit` / `service_approve` for defense in depth
- Purchase-unit correction and ingredient_substitutions CRUD still need Codex RPCs
