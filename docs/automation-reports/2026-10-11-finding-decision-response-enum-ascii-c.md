# MISE-005NL finding-decision response enum ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-finding-decision-response-enum-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing defect

`normalizeOperationalFindingDecision` used Unicode `requireBoundedText` on
response `decision_type`, `finding_category`, and `severity`, then checked the
trimmed tokens against closed allowlists. NBSP/em-space padding invented a
valid enum token on the response path:

```text
'\u00a0approved\u00a0'.trim() === 'approved'
'\u00a0inventory\u00a0'.trim() === 'inventory'
'\u2003warning\u2003'.trim() === 'warning'
```

ASCII-C canonicalize returns `null` for the same padded values, so the
allowlist never sees an invented token. The input path already fail-closes via
raw `Set.has` without trim and is intentionally left unchanged.

## Change

- Added `services/domain/operationalFindingDecisionResponseEnumIdentity.ts`
- Routed response `decision_type` / `finding_category` / `severity` through
  ASCII-C require helpers
- Preserved `Finding decision type is invalid.`, `Finding category is invalid.`,
  and `Finding severity is invalid.` plus the existing 16 / 32 / 16 bounds
- Left evidence type (#793), evidence id/summary, restaurant workspace (#791),
  `finding.id.trim()`, object identities (#790), response identity fields, and
  outbox tips alone

## Verification

- Focused `operationalFindingDecisionResponseEnumAsciiC` tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK. When landing with #790/#791/#792/#793, drop cross-assertions that
sibling fields still Unicode-trim (this tip asserts evidence type still uses
`requireBoundedText` until #793 lands).
