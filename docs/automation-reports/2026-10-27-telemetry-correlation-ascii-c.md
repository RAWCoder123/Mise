# MISE-005SE: pin telemetry correlation identity to ASCII C

Date: 2026-10-27

## Inventing proof

`services/domain/telemetrySecurity.ts` `safeCorrelationValue` previously
Unicode-trimmed correlation inputs before writing durable telemetry fields:

```ts
const normalized = value.trim();
```

Unicode padding therefore invented a clean correlation identity:

```ts
'\u2003req_abc123\u2003'.trim() === 'req_abc123'
```

Those invented values passed the allowlist pattern and were emitted as
`request_id`, `operation_id`, `restaurant_id`, and sibling correlation tags.
Soft empty / Unicode-only space also invented the per-field fallback branch
via `'\u2003'.trim() === ''`.

## Change

- Add `services/domain/telemetryCorrelationIdentity.ts` with ASCII-only end
  trim, Unicode-padding fail-closed canonicalize, and soft normalize that
  preserves prior per-field fallbacks.
- Route `buildTelemetryCorrelation` through
  `resolveTelemetryCorrelationValue`.
- Leave activity-event idempotency (#868), restaurant-tasks correlationId
  (#809), and Sentry payload sanitization alone.

## Verification

- Focused `tests/telemetryCorrelationAsciiC.test.ts`
- Existing `tests/telemetryCorrelation.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
