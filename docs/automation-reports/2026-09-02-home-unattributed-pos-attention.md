# Same-day unattributed POS temporal-authority findings (2026-09-02)

Tip: `cursor/mise-home-unattributed-pos-attention`  
Base: `origin/main` @ `20b28e5`

## Gap

After a verified midday inventory count, day-resolution POS sales for that same
operating day are already reflected in the count baseline. Mise correctly leaves
that demand **unattributed** and marks the projection non-temporally
authoritative (`unattributedTodayDepletion` / `isTemporallyAuthoritative`).

Inventory detail already explains absorbed POS (#318 open). Home / Daily Brief
did not surface the gap, so an otherwise healthy pulse could still read as an
all-clear while projected on-hand was provisional.

## Slice

- Domain: emit one urgent `data_quality` finding when same-day verified counts
  coexist with mapped POS demand for the operating date
  (`finding:data-gap:temporal-authority:YYYY-MM-DD`)
- Evidence names affected inventory items and absorbed quantities; missing-data
  marks `temporally_authoritative_projection`
- Recommended action: treat projected on-hand as provisional and recount after
  service
- Application: `fetchDailyOperationalBrief` now loads ledger count evidence and
  provider mappings so Daily Brief sees the same authority signal Home already
  receives via `fetchOperatingBrief`
- Home pulse elevates through the existing urgent-findings → `at_risk` path
  without editing contested `operatingBrief.ts` (#327/#328)

## Explicit non-goals

- Changing depletion arithmetic or inventing sale timestamps (see open #360)
- Cash-only / non-itemized Square refund diagnostics (after #357)
- Inventing MOQ / lead_time / expiration
- Reworking Home pulse helpers already open in #327/#328

## Paths

- `services/domain/operationalFindings.ts`
- `services/application/findings.ts`
- `tests/operationalFindings.test.ts`
- `docs/automation-reports/2026-09-02-home-unattributed-pos-attention.md`

## Verification

- `npm run typecheck`
- focused `tests/operationalFindings.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
