# Manual CSV POS ingest (2026-07-30)

## Completed

- Cherry-picked prior hardening onto `cursor/mise-product-inspection-7082`:
  secondary-table DML revocation, inventory movement ledger, account deletion, App Store checklist hooks.
- Added bounded manual CSV POS sales ingest for private beta:
  - Domain parser/payload builder (`services/domain/posCsvIngest.ts`)
  - Application API (`importManualPosSalesCsv` / `previewManualPosSalesCsv`)
  - Demo + hosted repository paths
  - Service-only RPC `service_ingest_manual_pos_sales`
  - `operational-workflows` action `ingest_pos_csv`
  - Settings POS UI paste/import for demo and hosted (live providers remain locked)
- Live `sync-pos-sales` remains fail-closed for Square/Toast/Clover/Lightspeed/manual_csv sync requests.

## Verification intended

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run design:static`

## Still open

- Docker + hosted re-proof of latest migrations
- Settings team membership UI
- Founder privacy/support URLs
- Apple/EAS/device QA
- Live POS/Gmail credentials
