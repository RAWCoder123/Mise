# Audit log browse — 2026-09-02

## Completed

- Owner/admin audit_logs browse on More → Audit log (`app/more/audit-logs.tsx`).
- Domain helpers for role gate, category filters, sort, tenant assert, and metadata sanitization.
- Repository `listAuditLogs` on demo + hosted (SELECT only; no client insert).
- Application `fetchAuditLogs` + presentation labels for known actions (EN/ES/zh-Hans).
- Hub fail-closed load state; More row hidden unless owner/admin membership.

## Verification intended

- `npm run typecheck`
- `npm test` (focused + hub/tenant contract pins)
- `npm run security:static`
- `npm run design:static`

## Security notes

- Hosted RLS already limits SELECT to owner/admin; UI mirrors that gate.
- Metadata strips tokens, emails, oversized strings, and nested objects before display.
- Writes remain server/RPC-owned; this tip is read-only.
