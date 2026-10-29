# MISE-005TS: pin Edge Sentry capture-context tokens to ASCII C

Date: 2026-10-29

## Inventing proof

Prior Edge `safeContextString` Unicode-trimmed Sentry capture-context tokens
before they fed `buildTelemetryCorrelation` and Sentry tags:

```text
('\u2003' + 'req_abc123' + '\u2003').trim() === 'req_abc123'
```

That invented clean durable `requestId` / `operationId` / `operation` /
`actionName` / `functionName` identity. Soft empty / Unicode-only space also
collapsed through `.trim()` into the intentional empty → fallback path
(`crypto.randomUUID()`, `"edge_function_error"`).

Open telemetry correlation tip #917 / MISE-005SE pins
`buildTelemetryCorrelation` itself, but `safeContextString` still invents
upstream of that tip: padded context is cleaned before correlation ever sees
it.

## Change

- New `services/domain/edgeSentryContextIdentity.ts` ASCII-end-trims only,
  fail-closes (soft-null) when Unicode padding remains, controls appear, or
  length > 256.
- `supabase/functions/_shared/mise.ts` `safeContextString` uses
  `normalizeEdgeSentryContextString` and preserves `?? undefined` for the live
  fallback chain.

## Left alone

- `buildTelemetryCorrelation` / `telemetryCorrelationIdentity` (#917)
- `sanitizeTelemetryRecord` / `safeExternalError`
- activity-event idempotency (#868)
- Square OAuth / catalog / order-sale `stringField` siblings (#938–#956)

## Verification

- Focused `tests/edgeSentryContextAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test` (full suite; inherited recalculationCycles cancellations only)
