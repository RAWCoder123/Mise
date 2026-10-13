# MISE-005OT mise-actions error ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-actions-error-ascii-c`  
Base: `origin/main` @ `78da737`

## Summary

Pins domain-layer mise-actions `markFailed` `error` to ASCII C multiline
free-text prep so Unicode trim cannot invent a clean durable failure message
via NBSP/em-space padding.

## Inventing proof

`markFailed` used `error.trim() || "Action failed."` before storing the durable
action error field. Em-space padding invented a clean message:

```text
'\u2003Provider unavailable\u2003'.trim() === 'Provider unavailable'
```

ASCII C prep (NBSP fold + C end-trim only; no internal `\s` collapse) leaves
em-space alone and keeps internal LF/TAB/CR.

## Change

- `services/domain/miseActionsErrorIdentity.ts`
- Route `markFailed` through `normalizeCanonicalMiseActionsError`
- Soft empty / Unicode-only spaces still default to `"Action failed."`
- Left `lesson` Unicode trim on `measureOutcome` alone (next tip)
- Left hydrate `error_message` pass-through and `requestedBy` pass-through alone

## Verification

Recorded after local gates on this tip branch.
